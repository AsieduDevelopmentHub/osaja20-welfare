/**
 * Min-heap priority queue for scheduled notification dispatch.
 * O(log n) insert and extract-min operations.
 */

export interface ScheduledItem<T> {
  id: string;
  scheduledAt: number;
  payload: T;
}

export class PriorityQueue<T> {
  private heap: ScheduledItem<T>[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  enqueue(item: ScheduledItem<T>): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): ScheduledItem<T> | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  peek(): ScheduledItem<T> | undefined {
    return this.heap[0];
  }

  peekDue(now: number): ScheduledItem<T>[] {
    const due: ScheduledItem<T>[] = [];
    while (this.heap.length > 0 && this.heap[0].scheduledAt <= now) {
      const item = this.dequeue();
      if (item) due.push(item);
    }
    return due;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].scheduledAt <= this.heap[index].scheduledAt) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.heap[left].scheduledAt < this.heap[smallest].scheduledAt) {
        smallest = left;
      }
      if (right < length && this.heap[right].scheduledAt < this.heap[smallest].scheduledAt) {
        smallest = right;
      }
      if (smallest === index) break;

      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}
