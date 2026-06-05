"""Min-heap priority queue for scheduled notification dispatch."""

from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class ScheduledItem(Generic[T]):
    id: str
    scheduled_at: float
    payload: T


class PriorityQueue(Generic[T]):
    def __init__(self) -> None:
        self._heap: list[ScheduledItem[T]] = []

    @property
    def size(self) -> int:
        return len(self._heap)

    def is_empty(self) -> bool:
        return len(self._heap) == 0

    def enqueue(self, item: ScheduledItem[T]) -> None:
        self._heap.append(item)
        self._bubble_up(len(self._heap) - 1)

    def dequeue(self) -> ScheduledItem[T] | None:
        if not self._heap:
            return None
        if len(self._heap) == 1:
            return self._heap.pop()

        minimum = self._heap[0]
        self._heap[0] = self._heap.pop()
        self._bubble_down(0)
        return minimum

    def peek(self) -> ScheduledItem[T] | None:
        return self._heap[0] if self._heap else None

    def peek_due(self, now: float) -> list[ScheduledItem[T]]:
        due: list[ScheduledItem[T]] = []
        while self._heap and self._heap[0].scheduled_at <= now:
            item = self.dequeue()
            if item:
                due.append(item)
        return due

    def _bubble_up(self, index: int) -> None:
        while index > 0:
            parent = (index - 1) // 2
            if self._heap[parent].scheduled_at <= self._heap[index].scheduled_at:
                break
            self._heap[parent], self._heap[index] = self._heap[index], self._heap[parent]
            index = parent

    def _bubble_down(self, index: int) -> None:
        length = len(self._heap)
        while True:
            left = 2 * index + 1
            right = 2 * index + 2
            smallest = index

            if left < length and self._heap[left].scheduled_at < self._heap[smallest].scheduled_at:
                smallest = left
            if right < length and self._heap[right].scheduled_at < self._heap[smallest].scheduled_at:
                smallest = right
            if smallest == index:
                break

            self._heap[smallest], self._heap[index] = self._heap[index], self._heap[smallest]
            index = smallest
