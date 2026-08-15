'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ReplayEvent } from '@/lib/types';

interface TimelineProps {
  events: ReplayEvent[];
  width?: number;
  height?: number;
}

const SERVICE_COLORS: Record<string, string> = {
  'order-service':     '#22d3ee',  // cyan
  'payment-service':  '#a78bfa',  // purple
  'inventory-service': '#f97316', // amber
};

const METHOD_SHAPES: Record<string, d3.SymbolType> = {
  'GET':    d3.symbolCircle,
  'POST':   d3.symbolSquare,
  'PUT':    d3.symbolDiamond,
  'DELETE': d3.symbolCross,
};

export function Timeline({ events, width = 960, height = 280 }: TimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || events.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 40, bottom: 50, left: 160 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const maxPos = d3.max(events, e => e.causalPosition) ?? 1;
    const xScale = d3.scaleLinear().domain([0, maxPos]).range([0, innerWidth]);
    
    const services = [...new Set(events.map(e => e.serviceId))];
    const yScale = d3.scalePoint().domain(services).range([0, innerHeight]).padding(0.5);

    // X axis (causal position, not wall clock)
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(Math.min(maxPos, 10)).tickFormat(d => `vc:${d}`))
      .call(g => {
        g.selectAll('text').attr('fill', '#737373').style('font-family', 'JetBrains Mono').style('font-size', '10px');
        g.selectAll('.domain, .tick line').attr('stroke', '#2a2a2a');
      });
    
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('fill', '#737373')
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .text('Causal Position (Vector Clock Order — NOT wall clock time)');

    // Y axis (services / swimlanes)
    g.append('g')
      .call(d3.axisLeft(yScale))
      .call(g => {
        g.selectAll('text')
          .attr('fill', '#e5e5e5')
          .style('font-family', 'JetBrains Mono')
          .style('font-size', '11px');
        g.selectAll('.domain, .tick line').attr('stroke', '#2a2a2a');
      });

    // Swimlane background stripes
    services.forEach((svc, i) => {
      g.append('rect')
        .attr('x', 0)
        .attr('y', (yScale(svc) ?? 0) - 20)
        .attr('width', innerWidth)
        .attr('height', 40)
        .attr('fill', i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent');
    });

    // Causal arrows (happens-before edges)
    events.forEach(event => {
      if (!event.causedBy) return;
      event.causedBy.forEach(prevId => {
        const prev = events.find(e => e.snapshotId === prevId);
        if (!prev) return;
        
        g.append('line')
          .attr('x1', xScale(prev.causalPosition))
          .attr('y1', yScale(prev.serviceId) ?? 0)
          .attr('x2', xScale(event.causalPosition))
          .attr('y2', yScale(event.serviceId) ?? 0)
          .attr('stroke', '#2a2a2a')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3')
          .attr('marker-end', 'url(#arrow)');
      });
    });

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('refX', 5).attr('refY', 3)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L0,6 L6,3 z')
      .attr('fill', '#404040');

    // Event circles with animation
    const eventGroups = g.selectAll('.event')
      .data(events)
      .join('g')
      .attr('class', 'event')
      .attr('transform', e => `translate(${xScale(e.causalPosition)},${yScale(e.serviceId) ?? 0})`)
      .style('cursor', 'pointer');

    // Status ring (match vs mismatch)
    eventGroups.append('circle')
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', e => e.statusCodeMatch ? '#22c55e' : '#ef4444')
      .attr('stroke-width', 1.5)
      .transition().duration(400).delay((_, i) => i * 50)
      .attr('r', 14);

    // Inner filled circle
    eventGroups.append('circle')
      .attr('r', 0)
      .attr('fill', e => SERVICE_COLORS[e.serviceId] || '#737373')
      .attr('fill-opacity', 0.8)
      .transition().duration(300).delay((_, i) => i * 50)
      .attr('r', 8);

    // Concurrent marker: events at same causal_position get amber glow
    const byPosition = d3.group(events, e => e.causalPosition);
    byPosition.forEach((evs, pos) => {
      if (evs.length > 1) {
        // Draw amber vertical line connecting concurrent events
        const ys = evs.map(e => yScale(e.serviceId) ?? 0);
        g.append('line')
          .attr('x1', xScale(pos))
          .attr('y1', d3.min(ys)! - 10)
          .attr('x2', xScale(pos))
          .attr('y2', d3.max(ys)! + 10)
          .attr('stroke', '#f97316')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-dasharray', '2,2');
        
        // "CONCURRENT" label
        g.append('text')
          .attr('x', xScale(pos))
          .attr('y', d3.min(ys)! - 16)
          .attr('text-anchor', 'middle')
          .attr('fill', '#f97316')
          .style('font-size', '9px')
          .style('font-family', 'JetBrains Mono')
          .text('CONCURRENT');
      }
    });

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .style('position', 'fixed')
      .style('background', '#1a1a1a')
      .style('border', '1px solid #2a2a2a')
      .style('border-radius', '6px')
      .style('padding', '10px 14px')
      .style('font-family', 'JetBrains Mono')
      .style('font-size', '11px')
      .style('color', '#e5e5e5')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('z-index', '1000')
      .style('max-width', '300px');

    eventGroups
      .on('mouseenter', (event, d) => {
        tooltip
          .style('opacity', '1')
          .html(`
            <div style="color:#22d3ee;margin-bottom:6px">${d.method} ${d.path}</div>
            <div>Service: ${d.serviceId}</div>
            <div>Status: ${d.capturedStatusCode} → ${d.replayStatusCode} ${d.statusCodeMatch ? '[MATCH]' : '[MISMATCH]'}</div>
            <div>Latency: ${d.capturedLatencyMs}ms (orig) / ${d.replayLatencyMs}ms (replay)</div>
            <div style="color:#737373;margin-top:4px">vc:${d.causalPosition}</div>
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.clientX + 12) + 'px')
          .style('top', (event.clientY - 10) + 'px');
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'));

    return () => { tooltip.remove(); };
  }, [events, width, height]);

  return (
    <div className="timeline-container">
      <svg ref={svgRef} style={{ display: 'block', width: '100%', minWidth: 600 }} />
    </div>
  );
}
