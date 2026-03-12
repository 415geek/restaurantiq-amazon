"use client";

import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, Clock, CheckCircle } from "lucide-react";
import SwipeToConfirm from "./SwipeToConfirm";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impactScore: number;
  urgencyLevel: "low" | "medium" | "high";
  category: "pricing" | "marketing" | "social" | "operations" | "inventory";
  expectedOutcome: string;
  rollbackAvailable: boolean;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onExecute: () => void;
  delay?: number;
}

export default function RecommendationCard({ 
  recommendation, 
  onExecute,
  delay = 0 
}: RecommendationCardProps) {
  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "high": return "#F26A36";
      case "medium": return "#FBBF24";
      default: return "#22C55E";
    }
  };

  const getImpactColor = (score: number) => {
    if (score >= 8) return "text-[#F26A36]";
    if (score >= 5) return "text-yellow-500";
    return "text-green-500";
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      pricing: "价格调整",
      marketing: "营销活动",
      social: "社交媒体",
      operations: "运营优化",
      inventory: "库存管理"
    };
    return labels[cat] || cat;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-2xl bg-zinc-900/50 border border-white/10 p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${getUrgencyColor(recommendation.urgencyLevel)}20` }}
          >
            <AlertTriangle 
              className="w-6 h-6" 
              style={{ color: getUrgencyColor(recommendation.urgencyLevel) }} 
            />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white">{recommendation.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                {getCategoryLabel(recommendation.category)}
              </span>
              <span 
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ 
                  backgroundColor: `${getUrgencyColor(recommendation.urgencyLevel)}20`,
                  color: getUrgencyColor(recommendation.urgencyLevel)
                }}
              >
                {recommendation.urgencyLevel === "high" ? "紧急" : 
                 recommendation.urgencyLevel === "medium" ? "中等" : "低"}
              </span>
            </div>
          </div>
        </div>

        {/* Impact Score */}
        <div className="text-right">
          <div className={`text-3xl font-bold ${getImpactColor(recommendation.impactScore)}`}>
            {recommendation.impactScore}
          </div>
          <div className="text-xs text-gray-400">Impact Score</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm mb-4 leading-relaxed">
        {recommendation.description}
      </p>

      {/* Expected Outcome */}
      <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
        <TrendingUp className="w-4 h-4 text-green-500" />
        <span className="text-sm text-green-400">{recommendation.expectedOutcome}</span>
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between mb-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>执行后 {recommendation.rollbackAvailable ? "5 分钟内可回滚" : "不可回滚"}</span>
        </div>
        {recommendation.rollbackAvailable && (
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-3 h-3" />
            <span>支持快速回滚</span>
          </div>
        )}
      </div>

      {/* Swipe to Confirm */}
      <SwipeToConfirm 
        onConfirm={onExecute}
        label="向右滑动以授权 Agent 自动执行"
      />
    </motion.div>
  );
}
