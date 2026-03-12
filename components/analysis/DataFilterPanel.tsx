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
            <select
              multiple
              value={filters.dataTypes}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions);
                const values = selectedOptions.map(option => option.value);
                handleDataTypeChange(values);
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:border-[#F26A36] focus:ring-1 focus:ring-[#F26A36]"
            >
              {availableDataTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
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
                  <label className="text-sm font-medium text-zinc-300 mb-2 block">
                    {lang === 'zh' ? '最大订单数' : 'Max Orders'}
                  </label>
                  <Input
                    type="number"
                    placeholder={lang === 'zh' ? '输入最大值' : 'Enter maximum'}
                    value={filters.customFilters.maxOrders || ''}
                    onChange={(e) => handleCustomFilterChange('maxOrders', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}