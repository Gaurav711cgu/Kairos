package com.demo.order;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private static final Logger log = LoggerFactory.getLogger(OrderController.class);

    @Value("${services.inventory-url}")
    private String inventoryUrl;

    @Value("${services.payment-url}")
    private String paymentUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    // POST /orders — THE BUGGY ENDPOINT (intentional race condition)
    @PostMapping
    public ResponseEntity<?> placeOrder(@RequestBody Map<String, String> body) {
        String productId = body.get("productId");
        String userId = body.get("userId");
        String orderId = UUID.randomUUID().toString().substring(0, 8);

        log.info("[{}] Order request: userId={} productId={}", orderId, userId, productId);

        // Step 1: CHECK inventory (READ)
        // BUG: No distributed lock held between read and write!
        ResponseEntity<Map> inventoryResp = restTemplate.getForEntity(
            inventoryUrl + "/inventory/" + productId, Map.class);
        int stock = ((Number) inventoryResp.getBody().get("stock")).intValue();

        log.info("[{}] Inventory check: productId={} stock={}", orderId, productId, stock);

        if (stock <= 0) {
            log.warn("[{}] Rejected: out of stock", orderId);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "out_of_stock", "orderId", orderId));
        }

        // Step 2: PROCESS payment (takes ~40ms — widens race window)
        ResponseEntity<Map> paymentResp = restTemplate.postForEntity(
            paymentUrl + "/payments",
            Map.of("orderId", orderId, "userId", userId, "amount", 99.99),
            Map.class);

        log.info("[{}] Payment: status={}", orderId, paymentResp.getBody().get("status"));

        // Step 3: DECREMENT inventory (WRITE)
        // BUG: Another request may have already decremented between our READ and this WRITE!
        restTemplate.postForEntity(
            inventoryUrl + "/inventory/" + productId + "/decrement",
            Map.of("orderId", orderId),
            Map.class);

        log.info("[{}] Order placed successfully! userId={} productId={}", orderId, userId, productId);

        return ResponseEntity.ok(Map.of(
            "orderId", orderId,
            "userId", userId,
            "productId", productId,
            "status", "CREATED"
        ));
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "order-service");
    }
}
