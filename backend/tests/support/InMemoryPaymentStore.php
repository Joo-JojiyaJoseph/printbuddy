<?php

use App\Services\Payments\PaymentStore;

final class InMemoryPaymentStore implements PaymentStore
{
    public array $events = [], $payments = [], $orders = [], $flags = [];
    public int $applyCalls = 0;

    public function recordWebhookEvent(string $eventId): bool
    {
        if (isset($this->events[$eventId])) return false;
        return $this->events[$eventId] = true;
    }
    public function payment(string $id): ?array { return $this->payments[$id] ?? null; }
    public function order(string $ref): ?array { return $this->orders[$ref] ?? null; }
    public function applyResult(string $id, string $paymentStatus, string $orderStatus): void
    {
        $this->applyCalls++;
        $this->payments[$id]['status'] = $paymentStatus;
        $this->orders[$this->payments[$id]['order_reference']]['status'] = $orderStatus;
    }
    public function flagForReview(string $id, string $reason): void { $this->flags[$id] = $reason; }
}
