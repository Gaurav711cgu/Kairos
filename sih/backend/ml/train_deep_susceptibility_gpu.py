"""
SAHAYAK GPU DEEP LEARNING TRAINING PIPELINE (PyTorch)
Model: Deep Spatial Attention Residual Neural Network (ResSpatialAttentionNet)
Hardware: Auto-detects NVIDIA CUDA / Apple Silicon MPS (Metal Performance Shaders) / CPU
"""

import os
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, recall_score, precision_score

# Feature definitions
FEATURE_NAMES = [
    "elevation_m", "slope_deg", "aspect_deg", "profile_curvature", "plan_curvature",
    "relief_amplitude_m", "tri", "tpi", "twi", "spi", "sti", "dist_to_drainage_m",
    "drainage_density", "flow_accumulation", "watershed_zone_code", "lithology_code",
    "dist_to_lineament_m", "lineament_density", "geomorphology_code", "lulc_code",
    "ndvi", "dist_to_road_m"
]

def get_compute_device():
    """Detects available GPU acceleration hardware"""
    if torch.cuda.is_available():
        device = torch.device("cuda")
        device_name = f"NVIDIA CUDA GPU ({torch.cuda.get_device_name(0)})"
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
        device_name = "Apple Silicon Metal GPU (MPS Accelerated)"
    else:
        device = torch.device("cpu")
        device_name = "CPU (SIMD / OpenMP Vectorized)"
    return device, device_name

class SpatialFeatureAttention(nn.Module):
    """Computes cross-feature self-attention weights to model complex geology-terrain interactions"""
    def __init__(self, in_features: int, hidden_dim: int = 64):
        super().__init__()
        self.query = nn.Linear(in_features, hidden_dim)
        self.key = nn.Linear(in_features, hidden_dim)
        self.scale = np.sqrt(hidden_dim)

    def forward(self, x):
        q = self.query(x)
        k = self.key(x)
        # Scaled dot-product attention score
        attn_scores = torch.sigmoid(torch.sum(q * k, dim=-1, keepdim=True) / self.scale)
        return x * attn_scores

class ResSpatialAttentionNet(nn.Module):
    """Deep Residual Network with Spatial Attention for Landslide Susceptibility Estimation"""
    def __init__(self, in_features: int = 22, hidden_dim: int = 128, dropout: float = 0.2):
        super().__init__()
        self.attention = SpatialFeatureAttention(in_features, hidden_dim=64)
        
        # Dense input projection
        self.input_layer = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.SiLU(),
            nn.Dropout(dropout)
        )

        # Residual Block 1
        self.res1_dense1 = nn.Linear(hidden_dim, hidden_dim)
        self.res1_bn1 = nn.BatchNorm1d(hidden_dim)
        self.res1_act = nn.SiLU()
        self.res1_dense2 = nn.Linear(hidden_dim, hidden_dim)
        self.res1_bn2 = nn.BatchNorm1d(hidden_dim)

        # Residual Block 2
        self.res2_dense1 = nn.Linear(hidden_dim, hidden_dim)
        self.res2_bn1 = nn.BatchNorm1d(hidden_dim)
        self.res2_act = nn.SiLU()
        self.res2_dense2 = nn.Linear(hidden_dim, hidden_dim)
        self.res2_bn2 = nn.BatchNorm1d(hidden_dim)

        # Output classification head
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.SiLU(),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        attended = self.attention(x)
        h = self.input_layer(attended)
        
        # ResBlock 1 with skip connection
        residual = h
        h1 = self.res1_act(self.res1_bn1(self.res1_dense1(h)))
        h1 = self.res1_bn2(self.res1_dense2(h1))
        h = self.res1_act(h1 + residual)

        # ResBlock 2 with skip connection
        residual2 = h
        h2 = self.res2_act(self.res2_bn1(self.res2_dense1(h)))
        h2 = self.res2_bn2(self.res2_dense2(h2))
        h = self.res2_act(h2 + residual2)

        out = self.head(h)
        return out

def generate_training_tensors(n_samples: int = 24000, random_state: int = 42):
    """Generates normalized tensor batches for PyTorch GPU training"""
    from ml.train_susceptibility_model import generate_synthetic_historical_dataset
    X_raw, Y_raw = generate_synthetic_historical_dataset(n_samples=n_samples, random_state=random_state)
    
    # Feature standardization
    means = np.mean(X_raw, axis=0)
    stds = np.std(X_raw, axis=0) + 1e-7
    X_norm = (X_raw - means) / stds

    X_train, X_test, y_train, y_test = train_test_split(X_norm, Y_raw, test_size=0.25, random_state=random_state, stratify=Y_raw)

    t_x_train = torch.tensor(X_train, dtype=torch.float32)
    t_y_train = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
    t_x_test = torch.tensor(X_test, dtype=torch.float32)
    t_y_test = torch.tensor(y_test, dtype=torch.float32).unsqueeze(1)

    return (t_x_train, t_y_train), (t_x_test, t_y_test), (means, stds)

def train_gpu_pipeline(epochs: int = 35, batch_size: int = 256, lr: float = 1e-3):
    device, device_name = get_compute_device()
    print("============================================================")
    print("   SAHAYAK GPU DEEP LEARNING SUSCEPTIBILITY PIPELINE")
    print("============================================================")
    print(f"  • Compute Hardware Detected: {device_name}")
    print(f"  • PyTorch Version:           {torch.__version__}")
    print("------------------------------------------------------------")

    (X_tr, y_tr), (X_te, y_te), (means, stds) = generate_training_tensors(n_samples=32000)
    train_dataset = TensorDataset(X_tr, y_tr)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    model = ResSpatialAttentionNet(in_features=22, hidden_dim=128).to(device)
    criterion = nn.BCELoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    print(f"  • Training Dataset:  {len(X_tr):,} samples across 22 variables")
    print(f"  • Holdout Test Set:  {len(X_te):,} samples")
    print(f"  • Training Batch:    {batch_size} on {device}")
    print("------------------------------------------------------------")

    start_time = time.time()
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for b_x, b_y in train_loader:
            b_x, b_y = b_x.to(device), b_y.to(device)
            optimizer.zero_grad()
            pred = model(b_x)
            loss = criterion(pred, b_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(b_x)

        scheduler.step()
        epoch_loss = total_loss / len(X_tr)

        if epoch % 5 == 0 or epoch == epochs:
            # Evaluate on holdout test set on GPU
            model.eval()
            with torch.no_grad():
                X_te_dev = X_te.to(device)
                y_pred_te = model(X_te_dev).cpu().numpy().flatten()
                y_true = y_te.numpy().flatten()
                auc = roc_auc_score(y_true, y_pred_te)
                recall = recall_score(y_true, (y_pred_te >= 0.5).astype(int))
                prec = precision_score(y_true, (y_pred_te >= 0.5).astype(int))

            print(f"  Epoch [{epoch:02d}/{epochs:02d}] - Loss: {epoch_loss:.4f} | Test AUC: {auc:.4f} | Recall: {recall*100:.1f}% | Precision: {prec*100:.1f}%")

    elapsed = time.time() - start_time
    throughput = (len(X_tr) * epochs) / elapsed
    print("------------------------------------------------------------")
    print(f"  GPU TRAINING COMPLETED in {elapsed:.2f}s ({throughput:,.0f} samples/sec)")
    print(f"  Final Holdout AUC-ROC: {auc:.4f}")
    print("------------------------------------------------------------")

    # Serialize PyTorch model artifact
    output_dir = os.path.join(os.path.dirname(__file__), "saved_models")
    os.makedirs(output_dir, exist_ok=True)
    model_save_path = os.path.join(output_dir, "susceptibility_deep_gpu.pt")
    
    torch.save({
        "model_state_dict": model.state_dict(),
        "means": means,
        "stds": stds,
        "feature_names": FEATURE_NAMES,
        "metrics": {"auc": float(auc), "recall": float(recall), "precision": float(prec)},
        "device_trained": device_name
    }, model_save_path)

    print(f"  Saved GPU Deep Model Artifact to: {model_save_path}")
    return model_save_path

if __name__ == "__main__":
    train_gpu_pipeline()
