<?php

namespace App\Services\Payments;

use InvalidArgumentException;

/**
 * Sandbox/test provider. Never used in production.
 * State lives in memory by default; pass load/save callables to persist it (e.g. in the cache)
 * so that the sandbox survives across HTTP requests.
 */
final class FakeUpiProvider implements PaymentProvider
{
    private array $payments = [];
    private int $seq = 0;

    /** @var null|callable():array */
    private $load;
    /** @var null|callable(array):void */
    private $save;

    public function __construct(?callable $load = null, ?callable $save = null)
    {
        $this->load = $load;
        $this->save = $save;
        if ($load !== null) {
            $state = $load();
            $this->payments = $state['payments'] ?? [];
            $this->seq = (int) ($state['seq'] ?? 0);
        }
    }

    public function createPayment(string $orderReference, int $amountPaise, string $currency): array
    {
        $id = 'fake_pay_' . (++$this->seq) . ($this->load ? '_' . bin2hex(random_bytes(3)) : '');
        $this->payments[$id] = ['status' => 'pending', 'amount_paise' => $amountPaise, 'currency' => $currency, 'order_reference' => $orderReference];
        $this->persist();
        return [
            'provider_payment_id' => $id,
            'qr_payload' => sprintf('upi://pay?pa=sandbox@upi&pn=PrintBuddy&am=%s&cu=%s&tr=%s', number_format($amountPaise / 100, 2, '.', ''), $currency, $orderReference),
            'expires_at' => time() + 300,
        ];
    }

    public function fetchPayment(string $providerPaymentId): array
    {
        return $this->payments[$providerPaymentId] ?? throw new InvalidArgumentException('Unknown payment.');
    }

    /** Test hook: what the customer's bank actually did. */
    public function simulate(string $id, string $status, ?int $amountPaise = null): void
    {
        if (!isset($this->payments[$id])) {
            throw new InvalidArgumentException('Unknown payment.');
        }
        $this->payments[$id]['status'] = $status;
        if ($amountPaise !== null) {
            $this->payments[$id]['amount_paise'] = $amountPaise;
        }
        $this->persist();
    }

    private function persist(): void
    {
        if ($this->save !== null) {
            ($this->save)(['payments' => $this->payments, 'seq' => $this->seq]);
        }
    }
}
