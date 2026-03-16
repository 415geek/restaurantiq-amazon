'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Database,
  ImageIcon,
  MapPin,
  MessageSquare,
  Play,
  Search,
  Send,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnalysisSummary } from '@/components/analysis/AnalysisSummary';
import { RecommendationList } from '@/components/analysis/RecommendationList';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { ContentTranslator } from '@/components/ui/ContentTranslator';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useExecution } from '@/hooks/useExecution';
import { useToast } from '@/hooks/useToast';
import { searchBusinessesByAddress, uploadOperationsDocuments } from '@/lib/api/analysis';
import { executionLogsMock, mockAnalysisResponse } from '@/lib/mock-data';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type {
  AgentAParserResult,
  AgentBAnalysisResult,
  AgentCPlannerResult,
  BusinessIntelSnapshot,
  BusinessSearchCandidate,
  Recommendation,
  UploadedOpsDocument,
} from '@/lib/types';
import {
  clearAnalysisRuntimeState,
  deleteAnalysisRuntimeState,
  fetchAnalysisRuntimeState,
  loadAnalysisRuntimeState,
  saveAnalysisRuntimeState,
} from '@/lib/client/analysis-runtime';

function formatCompactNumber(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}%`;
}

export function AnalysisClient() {
  const { copy, lang } = useDashboardLanguage();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const { analysis, recommendations, loading, error, sortBy, setSortBy, refresh, setAnalysis } =
    useRecommendations(mockAnalysisResponse);
  const { tasks, execute, rollback } = useExecution(executionLogsMock);

  const [addressInput, setAddressInput] = useState('');
  const [searchingBusinesses, setSearchingBusinesses] = useState(false);
  const [businessSearchWarning, setBusinessSearchWarning] = useState<string | undefined>();
  const [businessCandidates, setBusinessCandidates] = useState<BusinessSearchCandidate[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');

  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedOpsDocument[]>([]);
  const [uploadsExpanded, setUploadsExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submittingUploadedData, setSubmittingUploadedData] = useState(false);

  const [competitorAnalysis, setCompetitorAnalysis] = useState<any>(null);
  const [analyzingCompetitors, setAnalyzingCompetitors] = useState(false);

  const selectedBusiness = useMemo(
    () => businessCandidates.find((candidate) => candidate.id === selectedBusinessId),
    [businessCandidates, selectedBusinessId]
  );

  useEffect(() => {
    let disposed = false;

    async function bootstrapRuntime() {
      const remoteRuntime = await fetchAnalysisRuntimeState();
      const runtime = remoteRuntime ?? loadAnalysisRuntimeState();
      if (!runtime || disposed) return;
      setUploadedDocuments(runtime.uploadedDocuments ?? []);
      setAnalysis(runtime.analysis);
      if (remoteRuntime) saveAnalysisRuntimeState(remoteRuntime);
    }

    void bootstrapRuntime();
    return () => {
      disposed = true;
    };
  }, [setAnalysis]);

  useEffect(() => {
    if (!uploadedDocuments.length) {
      setUploadsExpanded(false);
    }
  }, [uploadedDocuments.length]);

  const runBusinessSearch = async () => {
    if (addressInput.trim().length < 3) {
      toast.error(lang === 'zh' ? '请输入更完整的地址再搜索。' : 'Enter a valid address before searching.');
      return;
    }

    setSearchingBusinesses(true);
    setBusinessSearchWarning(undefined);
    try {
      const result = await searchBusinessesByAddress(addressInput.trim());
      setBusinessCandidates(result.candidates);
      setSelectedBusinessId(result.candidates[0]?.id ?? '');
      setBusinessSearchWarning(result.warning);
      toast.success(
        lang === 'zh'
          ? `已找到 ${result.candidates.length} 个候选商家，请选择后运行分析。`
          : `${result.candidates.length} business candidate(s) found. Select one and run analysis.`
      );
    } catch (searchError) {
      setBusinessCandidates([]);
      setSelectedBusinessId('');
      toast.error(searchError instanceof Error ? searchError.message : 'Business search failed');
    } finally {
      setSearchingBusinesses(false);
    }
  };

  const runBusinessAnalysis = async (compareMode = false) => {
    if (!selectedBusiness) {
      toast.error(lang === 'zh' ? '请先选择一个商家。' : 'Please select a business first.');
      return;
    }

    const payload = {
      businessTarget: {
        name: selectedBusiness.name,
        address: selectedBusiness.address,
        googlePlaceId: selectedBusiness.googlePlaceId,
        yelpBusinessId: selectedBusiness.yelpBusinessId,
        lat: selectedBusiness.lat,
        lng: selectedBusiness.lng,
      },
      compareMode,
      uploadedDocuments,
    };

    const nextAnalysis = await refresh(payload);
    if (!nextAnalysis) {
      toast.error(
        lang === 'zh'
          ? '商家分析请求失败，已回退到本地结果。'
          : 'Business analysis request failed. Fallback output is shown.'
      );
      return;
    }
    saveAnalysisRuntimeState({
      analysis: nextAnalysis,
      uploadedDocuments,
      updatedAt: new Date().toISOString(),
    });
    toast.success(
      lang === 'zh'
        ? compareMode
          ? '商家对比分析已完成，已生成差距与优先策略。'
          : '商家分析已完成，已整合评论、图片与商圈信号。'
        : compareMode
          ? 'Comparison completed with prioritized strategic gaps.'
          : 'Business analysis complete with reviews, images, and market signals.'
    );
  };

  const submitUploadedDataForAnalysis = async () => {
    setSubmittingUploadedData(true);
    try {
      const nextAnalysis = await refresh({
        uploadedDocuments,
      });
      if (!nextAnalysis) {
        toast.error(
          lang === 'zh'
            ? '上传数据分析失败，已回退本地结果。'
            : 'Upload analysis failed. Showing fallback result.'
        );
        return;
      }
      saveAnalysisRuntimeState({
        analysis: nextAnalysis,
        uploadedDocuments,
        updatedAt: new Date().toISOString(),
      });
      toast.success(
        lang === 'zh'
          ? '上传数据已提交，Agent A/D 已完成分析并同步总览。'
          : 'Uploaded data submitted. Agent A/D analysis completed and synced.'
      );
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Failed to submit uploaded data');
    } finally {
      setSubmittingUploadedData(false);
    }
  };

  const runCompetitorAnalysis = async () => {
    setAnalyzingCompetitors(true);
    try {
      const response = await fetch('/api/nova-act/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myMenu: [],
          platforms: ['doordash', 'ubereats'],
          location: 'San Francisco, CA',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analysis failed');
      }
      setCompetitorAnalysis(data);
      toast.success(lang === 'zh' ? '竞争分析完成' : 'Competitor analysis complete');
    } catch {
      toast.error(lang === 'zh' ? '分析失败' : 'Analysis failed');
    } finally {
      setAnalyzingCompetitors(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const payload = await uploadOperationsDocuments(Array.from(files));
      setUploadedDocuments((prev) => {
        const next = [...payload.documents, ...prev];
        const seen = new Set<string>();
        return next.filter((doc) => {
          const key = `${doc.fileName}-${doc.size}-${doc.uploadedAt}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      toast.success(
        lang === 'zh'
          ? `已上传 ${payload.uploadedCount} 份文档，Agent A 已解析 ${payload.parsedCount} 份文本内容。`
          : `Uploaded ${payload.uploadedCount} document(s). Agent A parsed ${payload.parsedCount} text-based file(s).`
      );
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.analysisPage.title}
        description={
          lang === 'zh'
            ? '输入地址，选择目标商家后运行分析。系统会拉取 Google / Yelp 评论、图片与商圈数据，并输出可执行建议。'
            : 'Enter an address, select a target business, then run analysis. The system pulls Google/Yelp reviews, images, and area signals to output executable actions.'
        }
        badge={copy.analysisPage.badge}
      />

      <Card>
        <CardHeader className="border-b border-zinc-800/80">
          <CardTitle className="text-base">
            {lang === 'zh' ? '商家定位与分析入口' : 'Business Discovery & Analysis Entry'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Input
                value={addressInput}
                onChange={(event) => setAddressInput(event.target.value)}
                placeholder={
                  lang === 'zh'
                    ? '输入地址并搜索商家，例如：845 Stockton St, San Francisco, CA'
                    : 'Enter an address then search businesses, e.g. 845 Stockton St, San Francisco, CA'
                }
              />
            </div>
            <Button variant="secondary" onClick={() => void runBusinessSearch()} disabled={searchingBusinesses || loading}>
              <Search className="h-4 w-4" />
              {searchingBusinesses
                ? (lang === 'zh' ? '搜索中…' : 'Searching…')
                : lang === 'zh'
                  ? '搜索商家'
                  : 'Search business'}
            </Button>
            <Button onClick={() => void runBusinessAnalysis(false)} disabled={!selectedBusiness || loading}>
              <Play className="h-4 w-4" />
              {loading ? (lang === 'zh' ? '分析中…' : 'Analyzing…') : lang === 'zh' ? '分析已选商家' : 'Analyze selected'}
            </Button>
            <Button variant="secondary" onClick={() => void runBusinessAnalysis(true)} disabled={!selectedBusiness || loading}>
              <Play className="h-4 w-4" />
              {loading ? (lang === 'zh' ? '对比中…' : 'Comparing…') : lang === 'zh' ? '对比' : 'Compare'}
            </Button>
            <Button variant="secondary" onClick={() => void runCompetitorAnalysis()} disabled={analyzingCompetitors}>
              {lang === 'zh' ? '🔍 竞争对手分析 (Nova Act)' : '🔍 Competitor Analysis (Nova Act)'}
            </Button>
          </div>

          {businessSearchWarning ? (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200">
              {businessSearchWarning}
            </div>
          ) : null}

          {businessCandidates.length ? (
            <div className="grid gap-3">
              {businessCandidates.map((candidate) => {
                const selected = candidate.id === selectedBusinessId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedBusinessId(candidate.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-orange-500/40 bg-orange-500/10'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-100">
                      <span className="font-medium">{candidate.name}</span>
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
                        {candidate.source}
                      </span>
                      {candidate.rating !== undefined ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
                          <Star className="h-3 w-3" />
                          {candidate.rating}
                        </span>
                      ) : null}
                      {candidate.reviewCount !== undefined ? (
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
                          {lang === 'zh' ? `${candidate.reviewCount} 条评论` : `${candidate.reviewCount} reviews`}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-400">
                      <MapPin className="h-3 w-3" />
                      {candidate.address}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
              {lang === 'zh'
                ? '先输入地址并搜索商家，系统会返回 Google / Yelp 候选商家列表。'
                : 'Start by searching an address to load Google/Yelp candidate businesses.'}
            </div>
          )}
        </CardContent>
      </Card>

      {competitorAnalysis && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {lang === 'zh' ? '竞争对手分析结果' : 'Competitor Analysis Results'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-zinc-400">
              {lang === 'zh'
                ? competitorAnalysis.summary_zh ?? competitorAnalysis.summary
                : competitorAnalysis.summary ?? competitorAnalysis.summary_zh}
            </p>
            {competitorAnalysis.recommendations?.map((rec: any, index: number) => (
              <div key={index} className="mb-2 rounded bg-zinc-900/80 p-3">
                <div className="flex justify-between">
                  <span>{rec.itemName}</span>
                  <span>
                    ${rec.currentPrice} → ${rec.recommendedPrice}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {lang === 'zh' ? rec.rationale_zh ?? rec.rationale : rec.rationale ?? rec.rationale_zh}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader className="flex flex-col items-start gap-3 border-b border-zinc-800/80 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {lang === 'zh' ? '运营数据上传（可选补充）' : 'Operations Upload (Optional Supplement)'}
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              {lang === 'zh'
                ? '如果暂未接通 POS/外卖接口，可先上传文件作为 Agent A 的补充输入。'
                : 'If POS/delivery integrations are not connected yet, upload files as supplemental Agent-A inputs.'}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
            />
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={uploading}
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploading ? (lang === 'zh' ? '上传中…' : 'Uploading…') : lang === 'zh' ? '上传文档' : 'Upload'}
            </Button>
            {uploadedDocuments.length ? (
              <Button
                variant="ghost"
                className="w-full justify-start text-left sm:w-auto sm:justify-center sm:text-center"
                onClick={() => setUploadsExpanded((prev) => !prev)}
              >
                {uploadsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {uploadsExpanded
                  ? (lang === 'zh' ? '收起已上传' : 'Collapse uploaded')
                  : (lang === 'zh'
                      ? `展开已上传 (${uploadedDocuments.length})`
                      : `Expand uploaded (${uploadedDocuments.length})`)}
              </Button>
            ) : null}
            {uploadedDocuments.length ? (
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => {
                  setUploadedDocuments([]);
                  clearAnalysisRuntimeState();
                  void deleteAnalysisRuntimeState();
                  setAnalysis(mockAnalysisResponse);
                  toast.info(
                    lang === 'zh'
                      ? '已清空上传数据，并移除同步状态。'
                      : 'Uploaded data cleared and runtime sync reset.'
                  );
                }}
              >
                <Trash2 className="h-4 w-4" />
                {lang === 'zh' ? '清空' : 'Clear'}
              </Button>
            ) : null}
            <Button
              className="w-full sm:w-auto"
              onClick={() => void submitUploadedDataForAnalysis()}
              disabled={!uploadedDocuments.length || uploading || loading || submittingUploadedData}
            >
              <Send className="h-4 w-4" />
              {submittingUploadedData
                ? lang === 'zh'
                  ? '提交中…'
                  : 'Submitting…'
                : lang === 'zh'
                  ? '运营数据分析'
                  : 'Run Ops Data Analysis'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {uploadedDocuments.length ? (
            uploadsExpanded ? (
              uploadedDocuments.map((document) => (
                <div key={document.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-100">
                    <span className="font-medium">{document.fileName}</span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
                      {document.source === 'ubereats_api'
                        ? (lang === 'zh' ? 'Uber Eats 接入' : 'Uber Eats Integration')
                        : (lang === 'zh' ? '手动上传' : 'Manual upload')}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
                      {document.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        document.parsingStatus === 'parsed'
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                      }`}
                    >
                      {document.parsingStatus === 'parsed'
                        ? lang === 'zh'
                          ? '已解析'
                          : 'parsed'
                        : lang === 'zh'
                          ? '仅元数据'
                          : 'metadata only'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{document.excerpt}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                    <Database className="h-3.5 w-3.5" />
                    {(document.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
                {lang === 'zh'
                  ? `已上传 ${uploadedDocuments.length} 份文档，默认已折叠。点击"展开已上传"查看详情。`
                  : `${uploadedDocuments.length} uploaded document(s), collapsed by default. Click "Expand uploaded" to inspect details.`}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
              {lang === 'zh'
                ? '当前没有上传文档。此区域已去除冗长结构化预览，只保留必要摘要。'
                : 'No uploaded documents yet. Verbose structured preview has been removed and replaced with concise summaries.'}
            </div>
          )}
        </CardContent>
      </Card>

      <OpsDataAnalysisPanel
        lang={lang}
        uploadedDocuments={uploadedDocuments}
        agentAParsed={analysis.agentAParsed}
        agentBAnalyzed={analysis.agentBAnalyzed}
        validatedPlan={analysis.validatedPlan}
        loading={loading || submittingUploadedData}
        onRun={() => void submitUploadedDataForAnalysis()}
      />

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>
      ) : null}

      <AnalysisSummary
        summary={analysis.summary}
        signals={analysis.agentSignals}
        source={analysis.source}
        warning={analysis.warning}
      />

      {analysis.businessIntel ? (
        <BusinessIntelPanel
          intel={analysis.businessIntel}
          recommendations={analysis.recommendations ?? []}
          lang={lang}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-300">
            {copy.analysisPage.sortTitle} ({recommendations.length})
          </p>
          <p className="text-xs text-zinc-500">{copy.analysisPage.sortDesc}</p>
        </div>
        <Tabs
          value={sortBy}
          onChange={setSortBy}
          items={[
            { label: copy.analysisPage.sortComposite, value: 'composite' },
            { label: copy.analysisPage.sortImpact, value: 'impact' },
            { label: copy.analysisPage.sortUrgency, value: 'urgency' },
          ]}
        />
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60"
            />
          ))}
        </div>
      ) : (
        <RecommendationList
          recommendations={recommendations}
          tasks={tasks}
          onExecute={async (recommendation) => {
            await execute(recommendation);
            toast.success(`${copy.analysisPage.executeToastPrefix}${recommendation.title}`);
          }}
          onRollback={async (recommendation) => {
            await rollback(recommendation);
            toast.warning(`${copy.analysisPage.rollbackToastPrefix}${recommendation.title}`);
          }}
        />
      )}
    </div>
  );
}

function BusinessIntelPanel({
  intel,
  recommendations,
  lang,
}: {
  intel: BusinessIntelSnapshot;
  recommendations?: Recommendation[];
  lang: 'zh' | 'en';
}) {
  const topRecommendation = recommendations?.[0];
  return (
    <Card>
      <CardHeader className="border-b border-zinc-800/80">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {lang === 'zh' ? '商家情报与深度分析结果' : 'Business Intelligence Deep-Dive'}
          </CardTitle>
          {intel.platformIntel?.source ? (
            <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] text-sky-200">
              {intel.platformIntel.source === 'nova_act'
                ? (lang === 'zh' ? '平台情报 · Amazon Nova Act' : 'Platform Intel · Amazon Nova Act')
                : intel.platformIntel.source === 'api'
                  ? (lang === 'zh' ? '平台情报 · Amazon Nova' : 'Platform Intel · Amazon Nova')
                  : (lang === 'zh' ? '平台情报 · 回退数据' : 'Platform Intel · Fallback')}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {intel.target.name} · {intel.target.address}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard
            label={lang === 'zh' ? 'Google 评分' : 'Google Rating'}
            value={intel.ratings.google?.rating?.toFixed(1) ?? '-'}
            subtitle={
              intel.ratings.google?.reviewCount !== undefined
                ? `${intel.ratings.google.reviewCount} ${lang === 'zh' ? '条' : 'reviews'}`
                : '-'
            }
          />
          <MetricCard
            label={lang === 'zh' ? 'Yelp 评分' : 'Yelp Rating'}
            value={intel.ratings.yelp?.rating?.toFixed(1) ?? '-'}
            subtitle={
              intel.ratings.yelp?.reviewCount !== undefined
                ? `${intel.ratings.yelp.reviewCount} ${lang === 'zh' ? '条' : 'reviews'}`
                : '-'
            }
          />
          <MetricCard
            label={lang === 'zh' ? '商圈人口' : 'Population'}
            value={formatCompactNumber(intel.area.population)}
            subtitle={lang === 'zh' ? '县级 Census' : 'County census'}
          />
          <MetricCard
            label={lang === 'zh' ? '收入中位数' : 'Median income'}
            value={formatCurrency(intel.area.medianIncome)}
            subtitle={lang === 'zh' ? '年收入' : 'Annual'}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              {lang === 'zh' ? '区域信号' : 'Area Signals'}
            </p>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <p>{lang === 'zh' ? '城市' : 'City'}: {intel.area.city}</p>
              <p>{lang === 'zh' ? '天气' : 'Weather'}: {intel.area.weather}</p>
              <p>{lang === 'zh' ? '交通' : 'Traffic'}: {intel.area.traffic}</p>
              <p>
                {lang === 'zh' ? '商圈业态分布' : 'Business mix'}:{' '}
                {intel.area.businessMix.length
                  ? intel.area.businessMix.map((item) => `${item.type}(${item.count})`).join(' · ')
                  : '-'}
              </p>
              <p>{lang === 'zh' ? '数据源' : 'Source'}: {intel.area.source}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              {lang === 'zh' ? '分析结论摘要' : 'Executive summary'}
            </p>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <ContentTranslator
                originalContent={intel.personas.mckinsey.summary}
                contentType="analysis"
                size="sm"
                autoTranslate={lang === 'en'}
              />
              {topRecommendation ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-300">
                  <p className="text-zinc-400">{lang === 'zh' ? '首要建议' : 'Top recommendation'}</p>
                  <p className="mt-1 font-medium text-zinc-100">{topRecommendation.title}</p>
                  <div className="mt-1">
                    <ContentTranslator
                      originalContent={topRecommendation.expected_outcome}
                      contentType="analysis"
                      size="sm"
                      autoTranslate={lang === 'en'}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {intel.reviewDeepDive ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              {lang === 'zh' ? '评论深度分析' : 'Deep review analytics'}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <MetricCard label={lang === 'zh' ? '总评论' : 'Total reviews'} value={`${intel.reviewDeepDive.totalReviews}`} subtitle="Google + Yelp" />
              <MetricCard label={lang === 'zh' ? '正向' : 'Positive'} value={`${intel.reviewDeepDive.sentimentMix.positive}`} subtitle={lang === 'zh' ? '口碑优势' : 'Positive sentiment'} />
              <MetricCard label={lang === 'zh' ? '负向' : 'Negative'} value={`${intel.reviewDeepDive.sentimentMix.negative}`} subtitle={lang === 'zh' ? '优先修复' : 'Fix first'} />
              <MetricCard label={lang === 'zh' ? '混合' : 'Mixed'} value={`${intel.reviewDeepDive.sentimentMix.mixed}`} subtitle={lang === 'zh' ? '体验分化' : 'Experience split'} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {intel.reviewDeepDive.topThemes.map((theme, index) => (
                <div key={`${theme.theme}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <p className="text-xs text-zinc-400">{theme.priority.toUpperCase()}</p>
                  <p className="mt-1 text-sm font-medium text-zinc-100">{lang === 'zh' ? theme.theme_zh : theme.theme}</p>
                  <div className="mt-1">
                    <ContentTranslator
                      originalContent={lang === 'zh' ? theme.evidence_zh : theme.evidence}
                      contentType="analysis"
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {intel.competition ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              {lang === 'zh' ? '精准竞对分析' : 'Precise competitor analysis'}
            </p>
            <div className="mt-3 space-y-2">
              {(intel.competition.direct.length ? intel.competition.direct : []).map((item) => (
                <div key={item.name} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <p className="text-sm font-medium text-zinc-100">{item.name}</p>
                  <div className="mt-1">
                    <ContentTranslator
                      originalContent={lang === 'zh' ? item.rationale_zh : item.rationale}
                      contentType="analysis"
                      size="sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {(item.rating ?? '-')}{' '}
                    {lang === 'zh' ? '分' : 'rating'} · {(item.reviewCount ?? '-')} {lang === 'zh' ? '条评论' : 'reviews'}
                  </p>
                </div>
              ))}
            </div>
            {intel.competition.scenario.length ? (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <p className="text-xs text-zinc-400">{lang === 'zh' ? '场景竞对' : 'Scenario competitors'}</p>
                <p className="mt-1 text-xs text-zinc-300">
                  {intel.competition.scenario
                    .map((item) => (lang === 'zh' ? `${item.category}（${item.rationale_zh}）` : `${item.category} (${item.rationale})`))
                    .join(' · ')}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {(intel.consumerProfile || intel.platformIntel) ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-sm font-medium text-zinc-200">
              {lang === 'zh' ? '社区消费画像与平台情报' : 'Consumer profile & platform intelligence'}
            </p>
            {intel.consumerProfile ? (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-300">
                <p className="font-medium text-zinc-100">
                  {lang === 'zh' ? '消费画像' : 'Consumer profile'} · {intel.consumerProfile.incomeBand}
                </p>
                <p className="mt-1">
                  {lang === 'zh' ? intel.consumerProfile.spendingPattern_zh : intel.consumerProfile.spendingPattern}
                </p>
              </div>
            ) : null}
            {intel.platformIntel ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-zinc-400">
                  {lang === 'zh' ? '平台菜单/活动情报来源' : 'Platform menu/campaign source'}: {intel.platformIntel.source}
                </p>
                {intel.platformIntel.warnings?.length ? (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 text-[11px] text-yellow-100">
                    {intel.platformIntel.warnings.join(' ')}
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  {intel.platformIntel.menuItems.slice(0, 6).map((item, index) => (
                    <div key={`${item.platform}-${item.name}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-xs text-zinc-300">
                      <p className="font-medium text-zinc-100">{item.name}</p>
                      <p>{item.platform} · {item.price ? `$${item.price}` : '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
    </div>
  );
}

function ReviewList({
  title,
  icon,
  reviews,
  lang,
}: {
  title: string;
  icon: React.ReactNode;
  reviews: Array<{ author: string; rating?: number; text: string; time?: string }>;
  lang: 'zh' | 'en';
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200">
        {icon}
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {reviews.length ? (
          reviews.slice(0, 5).map((review, index) => (
            <div key={`${review.author}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="font-medium text-zinc-200">{review.author}</span>
                {review.rating !== undefined ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {review.rating}
                  </span>
                ) : null}
                {review.time ? <span>{new Date(review.time).toLocaleDateString()}</span> : null}
              </div>
              <div className="mt-2">
                <ContentTranslator
                  originalContent={review.text}
                  contentType="review"
                  size="sm"
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No reviews loaded.</p>
        )}
      </div>
    </div>
  );
}

function PhotoGrid({ title, photos }: { title: string; photos: string[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200">
        <ImageIcon className="h-4 w-4" />
        {title}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {photos.length ? (
          photos.slice(0, 3).map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="business visual"
                className="h-28 w-full object-cover transition group-hover:scale-105"
              />
            </a>
          ))
        ) : (
          <div className="col-span-3 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4 text-center text-xs text-zinc-500">
            No photos loaded.
          </div>
        )}
      </div>
    </div>
  );
}

function OpsDataAnalysisPanel({
  lang,
  uploadedDocuments,
  agentAParsed,
  agentBAnalyzed,
  validatedPlan,
  loading,
  onRun,
}: {
  lang: 'zh' | 'en';
  uploadedDocuments: UploadedOpsDocument[];
  agentAParsed?: AgentAParserResult;
  agentBAnalyzed?: AgentBAnalysisResult['analysis'];
  validatedPlan?: AgentCPlannerResult['plan'];
  loading: boolean;
  onRun: () => void;
}) {
  if (!uploadedDocuments.length) return null;

  const allCleaningActions = Array.from(
    new Set(uploadedDocuments.flatMap((document) => document.cleaningActions ?? []))
  ).slice(0, 8);
  const topInsights = agentBAnalyzed?.insights?.slice(0, 4) ?? [];
  const topTasks = validatedPlan?.task_board.tasks.slice(0, 4) ?? [];
  const p0Count = validatedPlan?.task_board.tasks.filter((task) => task.priority === 'P0').length ?? 0;

  const qualityTone =
    agentAParsed?.confidence.overall === 'high'
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
      : agentAParsed?.confidence.overall === 'medium'
        ? 'text-yellow-200 border-yellow-500/30 bg-yellow-500/10'
        : 'text-red-200 border-red-500/30 bg-red-500/10';

  return (
    <Card className="border-zinc-800 bg-zinc-950/60">
      <CardHeader className="border-b border-zinc-800/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {lang === 'zh' ? '运营数据分析 Agent' : 'Operations Analytics Agent'}
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              {lang === 'zh'
                ? '基于上传文档完成解析、清洗、经营诊断与可执行建议输出。'
                : 'Parses, cleans, diagnoses, and outputs executable recommendations from uploaded operating data.'}
            </p>
          </div>
          <Button onClick={onRun} disabled={loading}>
            <Play className="h-4 w-4" />
            {loading ? (lang === 'zh' ? '分析中…' : 'Analyzing…') : lang === 'zh' ? '重新分析' : 'Re-run analysis'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!agentAParsed || !agentBAnalyzed || !validatedPlan ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
            {lang === 'zh'
              ? '点击"运营数据分析"后，将生成解析清洗报告、经营洞察和可执行动作。'
              : 'Click "Run Ops Data Analysis" to generate parsing/cleaning report, insights, and executable actions.'}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                label={lang === 'zh' ? '已解析数据集' : 'Parsed datasets'}
                value={`${agentAParsed.meta.data_sources.length}`}
                subtitle={lang === 'zh' ? `上传文档 ${uploadedDocuments.length} 份` : `${uploadedDocuments.length} uploaded file(s)`}
              />
              <MetricCard
                label={lang === 'zh' ? '经营健康分' : 'Health score'}
                value={`${agentBAnalyzed.summary.health_score}`}
                subtitle={`${lang === 'zh' ? '等级' : 'Grade'} ${lang === 'zh' ? agentBAnalyzed.summary.health_grade_zh : agentBAnalyzed.summary.health_grade}`}
              />
              <MetricCard
                label={lang === 'zh' ? '高优先任务' : 'P0 tasks'}
                value={`${p0Count}`}
                subtitle={lang === 'zh' ? '需优先执行' : 'Need immediate action'}
              />
              <MetricCard
                label={lang === 'zh' ? '折扣率' : 'Discount rate'}
                value={formatPercent(agentAParsed.overview.discount_rate)}
                subtitle={lang === 'zh' ? '来自解析数据' : 'From parsed uploads'}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <p className="text-sm font-medium text-zinc-200">
                  {lang === 'zh' ? '解析与清洗结果' : 'Parsing & cleaning results'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-1 ${qualityTone}`}>
                    {lang === 'zh' ? '数据可信度' : 'Data confidence'}: {agentAParsed.confidence.overall}
                  </span>
                  <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
                    {lang === 'zh' ? '总订单' : 'Orders'}: {agentAParsed.overview.total_orders ?? '-'}
                  </span>
                  <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
                    {lang === 'zh' ? '总营收' : 'Revenue'}: {formatCurrency(agentAParsed.overview.total_revenue ?? undefined)}
                  </span>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  {(allCleaningActions.length ? allCleaningActions : agentAParsed.parsing_notes).map((item, index) => (
                    <li key={`${item}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <p className="text-sm font-medium text-zinc-200">
                  {lang === 'zh' ? '经营洞察（高质量）' : 'High-quality business insights'}
                </p>
                <div className="mt-3 space-y-3">
                  {topInsights.length ? (
                    topInsights.map((insight) => (
                      <div key={insight.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                        <p className="text-xs text-zinc-400">
                          {insight.icon} · {insight.priority}
                        </p>
                        <p className="mt-1 text-sm font-medium text-zinc-100">
                          {lang === 'zh' ? insight.finding_zh : insight.finding}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {lang === 'zh' ? insight.impact_zh : insight.impact}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">
                      {lang === 'zh' ? '暂无洞察，请重新运行分析。' : 'No insight available. Re-run analysis.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-sm font-medium text-zinc-200">
                {lang === 'zh' ? '可执行建议（按优先级）' : 'Executable recommendations (prioritized)'}
              </p>
              <div className="mt-3 space-y-3">
                {topTasks.length ? (
                  topTasks.map((task) => (
                    <div key={task.task_id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full border px-2 py-0.5 ${
                            task.priority === 'P0'
                              ? 'border-red-500/30 bg-red-500/10 text-red-300'
                              : task.priority === 'P1'
                                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                                : 'border-zinc-600 bg-zinc-800/50 text-zinc-300'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-300">{task.module}</span>
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-300">
                          {lang === 'zh' ? `${task.timeframe_days} 天` : `${task.timeframe_days} days`}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-zinc-100">
                        {lang === 'zh' ? task.title_zh : task.title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {lang === 'zh' ? task.why_now_zh : task.why_now}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        {lang === 'zh' ? '执行动作：' : 'Actions:'}
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-zinc-300">
                        {task.steps.slice(0, 3).map((step, stepIndex) => (
                          <li key={`${task.task_id}-${stepIndex}`}>
                            {lang === 'zh' ? step.action_zh : step.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    {lang === 'zh' ? '暂无可执行建议。' : 'No executable recommendations yet.'}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}