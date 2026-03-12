'use client';

import { useState } from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type { UploadedOpsDocument } from '@/lib/types';

interface DataFilter {
  timeRange: {
    startDate?: string;
    endDate?: string;
  };
  dataTypes: string[];
  customFilters: Record<string, string>;
}

interface DataFilterPanelProps {
  uploadedDocuments: UploadedOpsDocument[];
  onFilterChange: (filter: DataFilter) => void;
  onClearFilters: () => void;
}

export function DataFilterPanel({ uploadedDocuments, onFilterChange, onClearFilters }: DataFilterPanelProps) {
  const { lang } = useDashboardLanguage();
  const [filters, setFilters] = useState<DataFilter>({
    timeRange: {},
    dataTypes: [],
    customFilters: {}
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const availableDataTypes = Array.from(
    new Set(uploadedDocuments.map(doc => doc.category).filter(Boolean))
  );

  const handleTimeRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    const newFilters = {
      ...filters,
      timeRange: {
        ...filters.timeRange,
        [field]: value
      }
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDataTypeChange = (dataTypes: string[]) => {
    const newFilters = {
      ...filters,
      dataTypes
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleCustomFilterChange = (key: string, value: string) => {
    const newFilters = {
      ...filters,
      customFilters: {
        ...filters.customFilters,
        [key]: value
      }
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters: DataFilter = {
      timeRange: {},
      dataTypes: [],
      customFilters: {}
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
    onClearFilters();
  };

  const hasActiveFilters = Object.keys(filters.timeRange).length > 0 || 
                          filters.dataTypes.length > 0 || 
                          Object.keys(filters.customFilters).length > 0;

  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="flex flex-col items-start gap-3 border-b border-zinc-800/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-zinc-400" />
          <CardTitle className="text-base">
            {lang === 'zh' ? '数据筛选器' : 'Data Filters'}
          </CardTitle>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="h-4 w-4 mr-1" />
            {lang === 'zh' ? '清除所有筛选' : 'Clear all filters'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 时间范围筛选 */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              {lang === 'zh' ? '开始日期' : 'Start Date'}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="date"
                value={filters.timeRange.startDate || ''}
                onChange={(e) => handleTimeRangeChange('startDate', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              {lang === 'zh' ? '结束日期' : 'End Date'}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="date"
                value={filters.timeRange.endDate || ''}
                onChange={(e) => handleTimeRangeChange('endDate', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* 数据类型筛选 */}
        {availableDataTypes.length > 0 && (
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              {lang === 'zh' ? '数据类型' : 'Data Types'}
            </label>
            <Select
              multiple
              value={filters.dataTypes}
              onChange={handleDataTypeChange}
              options={availableDataTypes.map(type => ({
                value: type,
                label: type
              }))}
              placeholder={lang === 'zh' ? '选择数据类型...' : 'Select data types...'}
            />
          </div>
        )}

        {/* 高级筛选 */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            {showAdvanced ? '▼' : '▶'} {lang === 'zh' ? '高级筛选' : 'Advanced Filters'}
          </Button>
          
          {showAdvanced && (
            <div className="mt-3 space-y-3 p-3 border border-zinc-800 rounded-lg bg-zinc-900/50">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-zinc-300 mb-2 block">
                    {lang === 'zh' ? '最小订单数' : 'Min Orders'}
                  </label>
                  <Input
                    type="number"
                    placeholder={lang === 'zh' ? '输入最小值' : 'Enter minimum'}
                    value={filters.customFilters.minOrders || ''}
                    onChange={(e) => handleCustomFilterChange('minOrders', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium极分析报告组件，提供麦肯锡级别的详细分析输出">
'use client';

import { useState } from 'react';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ContentTranslator } from '@/components/ui/ContentTranslator';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type { AnalysisResponse } from '@/lib/types';

interface McKinseyAnalysisReportProps {
  analysis: AnalysisResponse;
  className?: string;
}

export function McKinseyAnalysisReport({ analysis, className = '' }: McKinseyAnalysisReportProps) {
  const { lang } = useDashboardLanguage();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['executive', 'financial', 'operational']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const downloadReport = () => {
    const reportContent = generateReportContent();
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restaurant-analysis-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateReportContent = (): string => {
    const sections = [
      `RESTAURANT INTELLIGENCE REPORT`,
      `Generated: ${new Date().toLocaleDateString()}`,
      `========================================`,
      '',
      `EXECUTIVE SUMMARY`,
      `================`,
      analysis.summary.insight,
      '',
      `Confidence Score: ${(analysis.summary.confidence * 100).toFixed(1)}%`,
      '',
      `KEY RECOMMENDATIONS`,
      `==================`,
      ...analysis.recommendations.slice(0, 5).map((rec, index) => 
        `${index + 1}. ${rec.title} (Impact: ${rec.impact_score}/10, Urgency: ${rec.urgency_level})`
      ),
      '',
      `FINANCIAL ANALYSIS`,
      `=================`,
      `Total Recommendations: ${analysis.recommendations.length}`,
      `High Impact Actions: ${analysis.recommendations.filter(r => r.impact_score >= 8).length}`,
      `Immediate Priority: ${analysis.recommendations.filter(r => r.urgency_level === 'high').length}`,
      '',
      `OPERATIONAL INSIGHTS`,
      `===================`,
      ...(analysis.agentBAnalyzed?.insights?.slice(0, 3) || []).map(insight => 
        `• ${insight.finding} (${insight.priority})`
      )
    ];

    return sections.join('\n');
  };

  return (
    <Card className={`border-zinc-800 bg-zinc-950/50 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/80">
        <CardTitle className="text-base">
          {lang === 'zh' ? '麦肯锡级别分析报告' : 'McKinsey-Level Analysis Report'}
        </CardTitle>
        <Button variant="secondary" size="sm" onClick={downloadReport}>
          <Download className="h-4 w-4 mr-2" />
          {lang === 'zh' ? '下载报告' : 'Download Report'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 执行摘要 */}
        <ReportSection
          title={lang === 'zh' ? '执行摘要' : 'Executive Summary'}
          id="executive"
          expanded={expandedSections.has('executive')}
          onToggle={toggleSection}
        >
          <div className="prose prose-invert prose-zinc max-w-none">
            <ContentTranslator
              originalContent={analysis.summary.insight}
              contentType="analysis"
              size="base"
            />
            <div className="mt-4 p-4 bg-zinc-900/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-400">{lang === 'zh' ? '置信度' : 'Confidence'}: </span>
                  <span className="text-green-400 font-medium">{(analysis.summary.confidence * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-zinc-400">{lang === 'zh' ? '数据源' : 'Data Source'}: </span>
                  <span className="text-blue-400 font-medium">{analysis.source}</span>
                </div>
              </div>
            </div>
          </div>
        </ReportSection>

        {/* 财务分析 */}
        <ReportSection
          title={lang === 'zh' ? '财务分析' : 'Financial Analysis'}
          id="financial"
          expanded={expandedSections.has('financial')}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label={lang === 'zh' ? '总建议数' : 'Total Recommendations'}
              value={analysis.recommendations.length.toString()}
              trend="neutral"
            />
            <MetricCard
              label={lang === 'zh' ? '高影响力' : 'High Impact'}
              value={analysis.recommendations.filter(r => r.impact_score >= 8).length.toString()}
              trend="positive"
            />
            <MetricCard
              label={lang === 'zh' ? '紧急优先' : 'Urgent Priority'}
              value={analysis.recommendations.filter(r => r.urgency_level === 'high').length.toString()}
              trend="negative"
            />
            <MetricCard
              label={lang === 'zh' ? '可执行' : 'Executable'}
              value={analysis.recommendations.filter(r => r.execution_params).length.toString()}
              trend="positive"
            />
          </div>
        </ReportSection>

        {/* 运营洞察 */}
        <ReportSection
          title={lang === 'zh' ? '运营洞察' : 'Operational Insights'}
          id="operational"
          expanded={expandedSections.has('operational')}
          onToggle={toggleSection}
        >
          <div className="space-y-3">
            {analysis.agentBAnalyzed?.insights?.slice(0, 5).map((insight, index) => (
              <div key={insight.id} className="p-4 bg-zinc-900/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                        {insight.icon} {insight.priority}
                      </span>
                    </div>
                    <h4 className="font-medium text-zinc-100 mb-2">
                      {lang === 'zh' ? insight.finding_zh : insight.finding}
                    </h4>
                    <p className="text-sm text-zinc-400">
                      {lang === 'zh' ? insight.impact_zh : insight.impact}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ReportSection>

        {/* 详细建议 */}
        <ReportSection
          title={lang === 'zh' ? '详细建议' : 'Detailed Recommendations'}
          id="recommendations"
          expanded={expandedSections.has('recommendations')}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            {analysis.recommendations.slice(0, 10).map((recommendation, index) => (
              <div key={recommendation.id} className="p-4 bg-zinc-900/50 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-zinc-100">
                      {index + 1}. {lang === 'zh' ? recommendation.title_zh : recommendation.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        recommendation.impact_score >= 8 
                          ? 'bg-green-500/20 text-green-300'
                          : recommendation.impact_score >= 6
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-zinc-500/20 text-zinc-300'
                      }`}>
                        Impact: {recommendation.impact_score}/10
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        recommendation.urgency_level === 'high'
                          ? 'bg-red-500/20 text-red-300'
                          : recommendation.urgency_level === 'medium'
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {recommendation.urgency_level}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <strong className="text-zinc-300">{lang === 'zh' ? '预期效果' : 'Expected Outcome'}: </strong>
                    <span className="text-zinc-400">{recommendation.expected_outcome}</span>
                  </div>
                  <div>
                    <strong className="text-zinc-300">{lang === 'zh' ? '执行步骤' : 'Execution Steps'}: </strong>
                    <ul className="mt-1 list-disc list-inside text-zinc-400">
                      {recommendation.steps.slice(0, 3).map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
      </CardContent>
    </Card>
  );
}

function ReportSection({ 
  title, 
  id, 
  children, 
  expanded, 
  onToggle 
}: { 
  title: string;
  id: string;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="border-b border-zinc-800 pb-6 last:border-b-0">
      <button
        onClick={() => onToggle(id)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-zinc-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-zinc-400" />
        )}
      </button>
      {expanded && <div className="mt-4">{children}</div>}
    </div>
  );
}

function MetricCard({ label, value, trend }: { label: string; value: string; trend: 'positive' | 'negative' | 'neutral' }) {
  const trendColors = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-zinc-400'
  };

  return (
    <div className="text-center p-4 bg-zinc-900/30 rounded-lg">
      <div className={`text-2xl font-bold ${trendColors[trend]}`}>{value}</div>
      <div className="text-sm text-zinc-400 mt-1">{label}</div>
    </div>
  );
}