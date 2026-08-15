package com.demo.payment;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;
import java.util.UUID;

@RestController
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    // POST /payments — INTENTIONALLY SLOW (40ms) to widen race window in order-service
    @PostMapping("/payments")
    public ResponseEntity<Map<String, Object>> processPayment(
            @RequestBody Map<String, Object> body) throws InterruptedException {

        String orderId = (String) body.get("orderId");
        String userId = (String) body.get("userId");
        double amount = ((Number) body.get("amount")).doubleValue();
        String paymentId = UUID.randomUUID().toString().substring(0, 8);

        log.info("[{}] Processing payment: userId={} amount={}", orderId, userId, amount);

        // INTENTIONAL DELAY: widens the race window in order-service
        // Without this, the race happens in ~3ms (hard to trigger)
        // With this, the race window is ~45ms (easy to trigger)
        Thread.sleep(40); // Simulates real payment gateway latency

        log.info("[{}] Payment approved: paymentId={}", orderId, paymentId);

        return ResponseEntity.ok(Map.of(
            "paymentId", paymentId,
            "orderId", orderId,
            "status", "APPROVED",
            "amount", amount
        ));
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "payment-service");
    }
}
