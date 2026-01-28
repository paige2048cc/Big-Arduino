import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useCircuitStore, useClickToPlace, useDragPreview } from '../../store/circuitStore';

// Pre-create transparent 1x1 image for hiding native drag preview
const EMPTY_IMG_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
import './ComponentLibrary.css';

// Component categories with images from public/components/
const componentCategories = [
  {
    id: 'microcontrollers',
    name: 'Microcontrollers',
    folder: 'microcontrollers',
    components: [
      { id: 'arduino-uno', name: 'Arduino Uno', image: 'arduino-uno.png' },
    ]
  },
  {
    id: 'boards',
    name: 'Boards',
    folder: 'boards',
    components: [
      { id: 'breadboard', name: 'Half-Size Breadboard', image: 'breadboard.png' },
    ]
  },
  {
    id: 'passive',
    name: 'Passive Components',
    folder: 'passive',
    components: [
      { id: 'led-5mm', name: 'LED (5mm)', image: 'LED_Red_OFF.png' },
      { id: 'Registor_220Ω', name: 'Resistor 220Ω', image: 'Registor_220Ω.png' },
      { id: 'pushbutton', name: 'Push Button', image: 'pushbutton_OFF.png' },
    ]
  },
];

interface ComponentLibraryProps {
  onComponentDragStart?: (componentId: string) => void;
}

export function ComponentLibrary({ onComponentDragStart }: ComponentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const clickToPlace = useClickToPlace();
  const startClickToPlace = useCircuitStore((state) => state.startClickToPlace);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['microcontrollers', 'boards', 'passive'])
  );
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const startDragPreview = useCircuitStore((state) => state.startDragPreview);
  const endDragPreview = useCircuitStore((state) => state.endDragPreview);
  const dragPreview = useDragPreview();

  // Pre-load empty image for hiding native drag preview
  const emptyImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = EMPTY_IMG_SRC;
    emptyImgRef.current = img;
  }, []);

  const handleDragStart = (e: React.DragEvent, componentId: string, category: string) => {
    e.dataTransfer.setData('componentId', componentId);
    e.dataTransfer.setData('category', category);
    e.dataTransfer.effectAllowed = 'copy';

    // Hide native drag preview - use pre-loaded transparent 1x1 image
    if (emptyImgRef.current) {
      e.dataTransfer.setDragImage(emptyImgRef.current, 0, 0);
    }

    // Start our custom drag preview
    startDragPreview(componentId, category);

    onComponentDragStart?.(componentId);
  };

  const handleDragEnd = () => {
    endDragPreview();
  };

  const handleComponentClick = (componentId: string, category: string) => {
    startClickToPlace(componentId, category);
  };

  const handleImageError = (componentId: string) => {
    setImageErrors(prev => new Set(prev).add(componentId));
  };

  const filteredCategories = componentCategories.map(category => ({
    ...category,
    components: category.components.filter(comp =>
      comp.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.components.length > 0);

  return (
    <div className="component-library">
      {/* Search */}
      <div className="component-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="component-categories">
        {filteredCategories.map(category => (
          <div key={category.id} className="component-category">
            <button
              className="category-header"
              onClick={() => toggleCategory(category.id)}
            >
              {expandedCategories.has(category.id) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <span>{category.name}</span>
              <span className="category-count">{category.components.length}</span>
            </button>

            {expandedCategories.has(category.id) && (
              <div className="category-components">
                {category.components.map(component => (
                  <div
                    key={component.id}
                    className={`component-item ${clickToPlace.isActive && clickToPlace.componentId === component.id ? 'selected' : ''} ${dragPreview.isActive && dragPreview.componentId === component.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, component.id, category.folder)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleComponentClick(component.id, category.folder)}
                  >
                    <div className="component-thumbnail">
                      {!imageErrors.has(component.id) ? (
                        <img
                          src={`${import.meta.env.BASE_URL}components/${category.folder}/${component.image}`}
                          alt={component.name}
                          onError={() => handleImageError(component.id)}
                        />
                      ) : (
                        <div className="component-placeholder">
                          {component.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <span className="component-name">{component.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
