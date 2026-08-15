"""
Collect real traffic metrics from the demo system for model training.
Run AFTER docker compose up and trigger-race.sh.
"""
import requests
import csv
import time
import os

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "training_data.csv")
SAMPLE_INTERVAL_S = 1
SAMPLES = 500

def query(metric: str) -> float:
    try:
        r = requests.get(f"{PROMETHEUS_URL}/api/v1/query",
                         params={"query": metric}, timeout=2)
        result = r.json().get("data", {}).get("result", [])
        return float(result[0]["value"][1]) if result else 0.0
    except Exception:
        return 0.0

def collect():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["latency_p99_ms", "error_rate_percent",
                         "requests_per_second", "latency_ratio",
                         "concurrent_requests"])

        for i in range(SAMPLES):
            p99 = query('histogram_quantile(0.99, rate(kairos_request_latency_microseconds_bucket[30s]))') / 1000
            p50 = query('histogram_quantile(0.50, rate(kairos_request_latency_microseconds_bucket[30s]))') / 1000
            err = query('rate(kairos_request_total{status=~"5.."}[30s])') * 100
            rps = query('rate(kairos_request_total[30s])')
            conc = query('kairos_snapshot_queued_total')

            p50 = max(p50, 1.0)
            p99 = max(p99, 10.0)
            writer.writerow([p99, err, rps, p99 / p50, conc])
            if (i + 1) % 50 == 0 or i == SAMPLES - 1:
                print(f"Sample {i+1}/{SAMPLES}: p99={p99:.1f}ms, rps={rps:.1f}")
            time.sleep(SAMPLE_INTERVAL_S)

if __name__ == "__main__":
    print(f"Collecting {SAMPLES} real traffic samples from {PROMETHEUS_URL}...")
    collect()
    print(f"Saved {SAMPLES} real traffic samples to {OUTPUT_FILE}")
