import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Check, Loader2 } from 'lucide-react';
import type { DetectedComponent } from '../../utils/componentMatcher';
import { getChipClass } from '../../utils/componentMatcher';
import './ComponentScanner.css';

// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as tmImage from '@teachablemachine/image';

const MODEL_URL = `${import.meta.env.BASE_URL}tm-model/`;
const CONFIDENCE_THRESHOLD = 0.9;
const SUSTAINED_DURATION_MS = 2000;

interface ComponentScannerProps {
  open: boolean;
  onClose: () => void;
  onComplete: (detected: DetectedComponent[], screenshot: string) => void;
}

export function ComponentScanner({ open, onClose, onComplete }: ComponentScannerProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [predictions, setPredictions] = useState<DetectedComponent[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState('');

  const modelRef = useRef<any>(null);
  const webcamRef = useRef<any>(null);
  const webcamContainerRef = useRef<HTMLDivElement>(null);
  const loopRunningRef = useRef(false);
  const mountedRef = useRef(true);
  const sustainedTrackRef = useRef<Map<string, number>>(new Map());

  const cleanup = useCallback(() => {
    loopRunningRef.current = false;
    if (webcamRef.current) {
      try { webcamRef.current.stop(); } catch (_) { /* ignore */ }
      webcamRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus('loading');
      setPredictions([]);
      setConfirmed(new Set());
      sustainedTrackRef.current.clear();
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        setStatus('loading');
        setErrorMsg('');

        console.log('[Scanner] Loading model from', MODEL_URL);
        const model = await tmImage.load(
          MODEL_URL + 'model.json',
          MODEL_URL + 'metadata.json'
        );
        if (cancelled) return;
        modelRef.current = model;
        console.log('[Scanner] Model loaded, classes:', model.getClassLabels?.() ?? 'unknown');

        const flip = true;
        const webcam = new tmImage.Webcam(320, 320, flip);
        await webcam.setup();
        if (cancelled) return;

        await webcam.play();
        webcamRef.current = webcam;
        console.log('[Scanner] Webcam started');

        if (webcamContainerRef.current) {
          webcamContainerRef.current.innerHTML = '';
          webcamContainerRef.current.appendChild(webcam.canvas);
        }

        if (mountedRef.current) setStatus('ready');

        loopRunningRef.current = true;
        runLoop(cancelled);
      } catch (err: any) {
        console.error('[Scanner] Init failed:', err);
        if (!cancelled && mountedRef.current) {
          setStatus('error');
          setErrorMsg(err?.message ?? 'Failed to initialize camera');
        }
      }
    }

    async function runLoop(parentCancelled: boolean) {
      while (loopRunningRef.current && !parentCancelled && mountedRef.current) {
        try {
          if (!webcamRef.current || !modelRef.current) break;

          webcamRef.current.update();
          const preds = await modelRef.current.predict(webcamRef.current.canvas);

          if (!loopRunningRef.current || parentCancelled || !mountedRef.current) break;

          const mapped: DetectedComponent[] = preds
            .filter((p: any) => p.className !== 'None')
            .map((p: any) => ({
              className: p.className,
              probability: p.probability,
            }));
          setPredictions(mapped);

          const now = Date.now();
          const track = sustainedTrackRef.current;

          for (const p of mapped) {
            if (p.probability >= CONFIDENCE_THRESHOLD) {
              if (!track.has(p.className)) {
                track.set(p.className, now);
              }
            } else {
              track.delete(p.className);
            }
          }

          setConfirmed(prev => {
            const next = new Set(prev);
            for (const [className, firstSeen] of track.entries()) {
              if (now - firstSeen >= SUSTAINED_DURATION_MS) {
                next.add(className);
              }
            }
            return next;
          });
        } catch (err) {
          console.warn('[Scanner] Prediction error (will retry):', err);
        }

        // ~5 FPS throttle
        await new Promise(r => setTimeout(r, 200));
      }
    }

    init();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open, cleanup]);

  const handleComplete = () => {
    const canvas = webcamRef.current?.canvas as HTMLCanvasElement | undefined;
    const screenshot = canvas ? canvas.toDataURL('image/jpeg', 0.85) : '';

    const detected: DetectedComponent[] = Array.from(confirmed).map(name => {
      const p = predictions.find(pr => pr.className === name);
      return { className: name, probability: p?.probability ?? 1 };
    });

    onComplete(detected, screenshot);
  };

  const handleRemoveTag = (name: string) => {
    setConfirmed(prev => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="scanner-overlay" onClick={onClose}>
      <div className="scanner-modal" onClick={e => e.stopPropagation()}>
        <div className="scanner-header">
          <div className="scanner-header-left">
            <Camera size={20} />
            <h2>Scan Components</h2>
          </div>
          <button className="scanner-close" onClick={onClose} type="button" aria-label="Close scanner">
            <X size={20} />
          </button>
        </div>

        <div className="scanner-body">
          <div className="scanner-webcam-area">
            {status === 'loading' && (
              <div className="scanner-loading">
                <Loader2 size={32} className="scanner-spinner" />
                <p>Loading camera & model...</p>
              </div>
            )}
            {status === 'error' && (
              <div className="scanner-error">
                <p>Could not start camera</p>
                <p className="scanner-error-detail">{errorMsg}</p>
              </div>
            )}
            <div
              ref={webcamContainerRef}
              className={`scanner-webcam ${status === 'ready' ? 'visible' : ''}`}
            />
          </div>

          {status === 'ready' && (
            <div className="scanner-predictions">
              <div className="scanner-predictions-label">Live Detection</div>
              <div className="scanner-bars">
                {[...predictions]
                  .sort((a, b) => b.probability - a.probability)
                  .map(p => (
                    <div key={p.className} className="scanner-bar-row">
                      <span className="scanner-bar-name">{p.className}</span>
                      <div className="scanner-bar-track">
                        <div
                          className={`scanner-bar-fill ${p.probability >= CONFIDENCE_THRESHOLD ? 'high' : ''}`}
                          style={{ width: `${Math.round(p.probability * 100)}%` }}
                        />
                      </div>
                      <span className="scanner-bar-pct">{Math.round(p.probability * 100)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="scanner-footer">
          <div className="scanner-tags">
            <span className="scanner-tags-label">Detected:</span>
            {confirmed.size === 0 && (
              <span className="scanner-tags-empty">Point camera at your components...</span>
            )}
            {Array.from(confirmed).map(name => (
              <span key={name} className={`scanner-tag ${getChipClass(name)}`}>
                {name}
                <button
                  className="scanner-tag-remove"
                  onClick={() => handleRemoveTag(name)}
                  type="button"
                  aria-label={`Remove ${name}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <button
            className="scanner-done-btn"
            onClick={handleComplete}
            disabled={confirmed.size === 0}
            type="button"
          >
            <Check size={18} />
            Done ({confirmed.size})
          </button>
        </div>
      </div>
    </div>
  );
}
