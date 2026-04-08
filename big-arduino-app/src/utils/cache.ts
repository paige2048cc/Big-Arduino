/**
 * LRU Cache Implementation
 *
 * Simple Least Recently Used cache for improving performance
 * of frequently accessed data like knowledge entries and component definitions.
 */

interface CacheNode<T> {
  key: string;
  value: T;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, CacheNode<T>>;
  private head: CacheNode<T> | null;
  private tail: CacheNode<T> | null;
  private hits: number;
  private misses: number;

  constructor(capacity: number = 50) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const node = this.cache.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    this.hits++;
    this.moveToHead(node);
    return node.value;
  }

  /**
   * Put value into cache
   */
  put(key: string, value: T): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      existingNode.value = value;
      this.moveToHead(existingNode);
      return;
    }

    const newNode: CacheNode<T> = {
      key,
      value,
      prev: null,
      next: null,
    };

    this.cache.set(key, newNode);
    this.addToHead(newNode);

    if (this.cache.size > this.capacity) {
      const removed = this.removeTail();
      if (removed) {
        this.cache.delete(removed.key);
      }
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; capacity: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  private moveToHead(node: CacheNode<T>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: CacheNode<T>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: CacheNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private removeTail(): CacheNode<T> | null {
    if (!this.tail) {
      return null;
    }

    const removed = this.tail;
    this.removeNode(removed);
    return removed;
  }
}

/**
 * Create a cache key from multiple parameters
 */
export function createCacheKey(...parts: (string | number | boolean | undefined)[]): string {
  return parts
    .filter(p => p !== undefined && p !== null)
    .map(p => String(p))
    .join(':');
}
