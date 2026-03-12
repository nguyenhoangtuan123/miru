import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Network } from 'vis-network';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Activity, LoaderCircle, Map, List, Search } from 'lucide-react';
import {
  getMemories,
  getMemoryGraph,
  getTimeline,
  searchMemories,
} from '../services/backend';
import type { TimelineItem } from '../services/contracts';

type MemoryCard = {
  id: string;
  content: string;
  createdAt?: string;
};

function extractMemoryContent(memory: {
  memory?: string;
  content?: string;
  text?: unknown;
  summary?: unknown;
}) {
  const content = memory.memory ?? memory.content ?? memory.text ?? memory.summary;
  return typeof content === 'string' ? content : 'Memory item';
}

export function Memories() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'map' | 'timeline'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState<MemoryCard[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: unknown[]; edges: unknown[] } | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<Network | null>(null);

  useEffect(() => {
    if (activeTab !== 'map' || !graphData || !networkRef.current) {
      return;
    }

    networkInstanceRef.current?.destroy();

    const options = {
      nodes: {
        shape: 'dot',
        size: 20,
        font: { color: '#ffffff', face: 'Manrope' },
        color: { background: '#7f0df2', border: '#ffffff' },
      },
      edges: {
        color: 'rgba(255,255,255,0.2)',
        width: 1,
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
      },
      physics: {
        barnesHut: { gravitationalConstant: -2000, springConstant: 0.04 },
      },
    } as const;

    networkInstanceRef.current = new Network(
      networkRef.current,
      graphData as never,
      options as never
    );

    return () => {
      networkInstanceRef.current?.destroy();
      networkInstanceRef.current = null;
    };
  }, [activeTab, graphData]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (activeTab === 'list') {
          const response = searchQuery.trim()
            ? await searchMemories(user.id, searchQuery.trim())
            : await getMemories(user.id);

          if (cancelled) {
            return;
          }

          setMemories(
            response.memories.map((memory, index) => ({
              id: String(memory.id ?? `${index}`),
              content: extractMemoryContent(memory),
              createdAt:
                typeof memory.created_at === 'string' ? memory.created_at : undefined,
            }))
          );
          return;
        }

        if (activeTab === 'map') {
          const response = await getMemoryGraph(user.id);
          if (cancelled) {
            return;
          }

          const centralNode = response.graph.central_node
            ? [
                {
                  ...(response.graph.central_node as Record<string, unknown>),
                  id:
                    (response.graph.central_node as Record<string, unknown>).id ?? 'user',
                  label:
                    (response.graph.central_node as Record<string, unknown>).label ?? 'Bạn',
                },
              ]
            : [];

          setGraphData({
            nodes: [...centralNode, ...response.graph.nodes],
            edges: response.graph.edges,
          });
          return;
        }

        const response = await getTimeline(user.id);
        if (!cancelled) {
          setTimelineData(response.timeline);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu memory');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const debounceId = window.setTimeout(loadData, activeTab === 'list' ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
    };
  }, [activeTab, searchQuery, user?.id]);

  return (
    <div className="min-h-screen bg-miru-bg p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Ký ức của bạn</h1>
            <p className="text-white/60">
              Dữ liệu ở màn này đang đọc trực tiếp từ memory routes của backend.
            </p>
          </div>
          {isLoading && (
            <div className="text-sm text-white/40 flex items-center gap-2">
              <LoaderCircle size={16} className="animate-spin" />
              Đang tải
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        )}

        <div className="flex p-1 glass-panel rounded-2xl w-fit mb-8">
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === 'list'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white'
            )}
          >
            <List size={18} /> Danh sách
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === 'map'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white'
            )}
          >
            <Map size={18} /> Bản đồ
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === 'timeline'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white'
            )}
          >
            <Activity size={18} /> Hành trình
          </button>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-panel min-h-[60vh] p-6"
        >
          {activeTab === 'list' && (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="text"
                  placeholder="Tìm kiếm ký ức..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-miru-primary/50 transition-colors"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {memories.length === 0 ? (
                  <p className="text-white/40 col-span-full text-center py-12">
                    Chưa tìm thấy memory nào.
                  </p>
                ) : (
                  memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors"
                    >
                      <p className="text-sm text-white/60 mb-2">
                        {memory.createdAt
                          ? new Date(memory.createdAt).toLocaleDateString('vi-VN')
                          : 'Không rõ thời gian'}
                      </p>
                      <p className="line-clamp-4 text-white/90">{memory.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="w-full h-[60vh] rounded-2xl overflow-hidden bg-black/20 relative">
              {!graphData && (
                <div className="absolute inset-0 flex items-center justify-center text-white/40">
                  Đang tải bản đồ ký ức...
                </div>
              )}
              <div ref={networkRef} className="w-full h-full" />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {timelineData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-white/40">
                  <Activity size={48} className="mb-4 opacity-50" />
                  <p>Chưa có timeline insight nào để hiển thị.</p>
                </div>
              ) : (
                timelineData.map((item, index) => (
                  <div
                    key={`${item.date ?? 'timeline'}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <p className="text-sm text-miru-primary mb-2">
                      {item.date ?? 'Không rõ ngày'}
                    </p>
                    <h3 className="font-semibold text-lg mb-2">
                      {item.title ?? 'Phiên trò chuyện'}
                    </h3>
                    <p className="text-white/70 leading-relaxed">
                      {item.summary ?? 'Chưa có tóm tắt'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
