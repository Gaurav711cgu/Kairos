package com.demo.inventory;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;

@RestController
public class InventoryController {

    private static final Logger log = LoggerFactory.getLogger(InventoryController.class);
    private final JdbcTemplate db;

    public InventoryController(JdbcTemplate db) { this.db = db; }

    // GET /inventory/{productId} — READ without lock (the bug's first half)
    @GetMapping("/inventory/{productId}")
    public ResponseEntity<Map<String, Object>> getStock(@PathVariable String productId) {
        // BUG: plain SELECT — no FOR UPDATE, no locking
        // Two concurrent reads BOTH see stock=1 → both proceed to order
        Integer stock = db.queryForObject(
            "SELECT stock FROM inventory WHERE product_id = ?",
            Integer.class, productId);

        log.info("Stock check: productId={} stock={}", productId, stock);

        return ResponseEntity.ok(Map.of(
            "productId", productId,
            "stock", stock != null ? stock : 0
        ));
    }

    // POST /inventory/{productId}/decrement — WRITE (no idempotency, no lock)
    @PostMapping("/inventory/{productId}/decrement")
    public ResponseEntity<Map<String, Object>> decrementStock(
            @PathVariable String productId,
            @RequestBody Map<String, String> body) {

        String orderId = body.get("orderId");

        // BUG: UPDATE without checking current stock — can go negative!
        int updated = db.update(
            "UPDATE inventory SET stock = stock - 1 WHERE product_id = ?",
            productId);

        Integer newStock = db.queryForObject(
            "SELECT stock FROM inventory WHERE product_id = ?",
            Integer.class, productId);

        log.warn("Decremented: productId={} orderId={} newStock={}", productId, orderId, newStock);

        if (newStock != null && newStock < 0) {
            log.error("GHOST ORDER DETECTED! stock={} productId={} orderId={}",
                newStock, productId, orderId);
        }

        return ResponseEntity.ok(Map.of(
            "productId", productId,
            "orderId", orderId,
            "newStock", newStock != null ? newStock : -1,
            "status", newStock != null && newStock >= 0 ? "OK" : "OVERSOLD"
        ));
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "inventory-service");
    }
}
