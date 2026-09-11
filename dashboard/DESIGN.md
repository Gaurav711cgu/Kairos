# Kairos Design System

## Core Concept
The "Agentic Actions Auditor". A dark, immersive, high-tech interface that visualizes complex distributed systems data (Vector Clocks, Traces) and AI reasoning (RCA).

## Typography
- **Sans**: System defaults (Inter/Geist), used for high legibility data tables.
- **Mono**: System defaults (SF Mono/Geist Mono), used for trace data, clock vectors, and code fixes.

## Colors
- **Background**: Stark Black (`#050505`) - allows the 3D scene to breathe.
- **Panels**: Midnight Gray (`#0f0f11`) with a 80% opacity and heavy backdrop blur (`backdrop-blur-md`).
- **Accents**: 
  - Neon Cyan (`#00f0ff`) for vector clocks and active events.
  - Deep Purple (`#b026ff`) for AI/LLM interventions and root causes.

## Animation (Anime.js & Magic Animator)
- **Spring Physics**: All major transitions use spring physics `spring(1, 80, 10, 0)` rather than linear easing. This gives a premium, "elastic" feel.
- **Staggering**: Lists and timeline items MUST use `anime.stagger(100)` for organic reveals.
- **Micro-interactions**: Hovering over causal nodes expands them slightly (`scale: 1.05`) with a fast spring.

## 3D Web Experience (React Three Fiber)
- The background consists of a 3D visualization representing the "space-time" of the distributed system.
- Orbs represent microservices, connected by bezier curves (network requests). 
- Slow, ambient rotation (`useFrame`) ensures the background is kinetic but not distracting.
