"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface AgentCardProps {
  title: string;
  icon: LucideIcon;
  color: string;
  metrics: { label: string; value: string; trend?: string }[];
  status?: "active" | "warning" | "alert";
  delay?: number;
}

export default function AgentCard({ 
  title, 
  icon: Icon, 
  color, 
  metrics, 
  status = "active",
  delay = 0 
}: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative overflow-hidden rounded-2xl bg-zinc-900/50 border border-white/10 p-5"
    >
      {/* Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div 
          className={`w-2 h-2 rounded-full ${
            status === "active" ? "bg-green-500" :
            status === "warning" ? "bg-yellow-500" : "bg-red-500"
          }`}
          style={{ boxShadow: `0 0 8px ${color}` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {metrics.map((metric, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{metric.label}</span>
            <div className="text-right">
              <span className="text-base font-semibold text-white">{metric.value}</span>
              {metric.trend && (
                <span className={`text-xs ml-2 ${
                  metric.trend.startsWith("+") ? "text-green-500" : "text-red-500"
                }`}>
                  {metric.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
