package com.timemachine.clock;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

public record VectorClock(Map<String, Long> clocks) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public VectorClock(Map<String, Long> clocks) {
        this.clocks = clocks == null ? Map.of() : Map.copyOf(clocks);
    }

    public VectorClock tick(String serviceId) {
        Map<String, Long> newClocks = new HashMap<>(clocks);
        long current = newClocks.getOrDefault(serviceId, 0L);
        if (current == Long.MAX_VALUE) {
            throw new VectorClockOverflowException("Vector clock overflow for service: " + serviceId);
        }
        newClocks.put(serviceId, current + 1);
        return new VectorClock(newClocks);
    }

    public VectorClock merge(VectorClock other) {
        if (other == null || other.clocks().isEmpty()) return this;
        Map<String, Long> newClocks = new HashMap<>(this.clocks);
        for (Map.Entry<String, Long> entry : other.clocks().entrySet()) {
            newClocks.merge(entry.getKey(), entry.getValue(), Math::max);
        }
        return new VectorClock(newClocks);
    }

    public CausalRelation compare(VectorClock other) {
        if (other == null) return CausalRelation.CONCURRENT;

        boolean thisStrictlyLess = false;
        boolean otherStrictlyLess = false;

        for (String key : this.clocks.keySet()) {
            long val1 = this.clocks.getOrDefault(key, 0L);
            long val2 = other.clocks().getOrDefault(key, 0L);
            if (val1 < val2) {
                thisStrictlyLess = true;
            } else if (val1 > val2) {
                otherStrictlyLess = true;
            }
        }

        for (String key : other.clocks().keySet()) {
            if (!this.clocks.containsKey(key)) {
                long val1 = 0L;
                long val2 = other.clocks().getOrDefault(key, 0L);
                if (val1 < val2) {
                    thisStrictlyLess = true;
                } else if (val1 > val2) {
                    otherStrictlyLess = true;
                }
            }
        }

        if (thisStrictlyLess && !otherStrictlyLess) {
            return CausalRelation.HAPPENS_BEFORE;
        } else if (!thisStrictlyLess && otherStrictlyLess) {
            return CausalRelation.HAPPENS_AFTER;
        } else {
            return CausalRelation.CONCURRENT;
        }
    }

    public String toHeader() {
        return clocks.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> e.getKey() + ":" + e.getValue())
                .collect(Collectors.joining(","));
    }

    public static VectorClock fromHeader(String header) {
        if (header == null || header.isBlank()) return new VectorClock(Map.of());
        Map<String, Long> map = new HashMap<>();
        String[] parts = header.split(",");
        for (String part : parts) {
            String[] kv = part.split(":");
            if (kv.length == 2) {
                map.put(kv[0].trim(), Long.parseLong(kv[1].trim()));
            }
        }
        return new VectorClock(map);
    }

    @JsonValue
    public String toJson() {
        try {
            return MAPPER.writeValueAsString(clocks);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize VectorClock", e);
        }
    }

    @JsonCreator
    public static VectorClock fromJson(String json) {
        if (json == null || json.isBlank()) return new VectorClock(Map.of());
        try {
            Map<String, Long> map = MAPPER.readValue(json, new TypeReference<Map<String, Long>>() {});
            return new VectorClock(map);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize VectorClock", e);
        }
    }

    public static VectorClock of(String... serviceIds) {
        Map<String, Long> map = new HashMap<>();
        for (String s : serviceIds) {
            map.put(s, 0L);
        }
        return new VectorClock(map);
    }
}
