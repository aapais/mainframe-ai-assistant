import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  Alert, AlertDescription, Separator
} from '@/components/ui';
import {
  Network, GitBranch, Link2, Unlink, Search, Plus, Trash2,
  ChevronDown, ChevronRight, Info, AlertTriangle, CheckCircle,
  ExternalLink, Filter, RefreshCw, Maximize2, Minimize2
} from 'lucide-react';
import * as d3 from 'd3';

// Types for incident relationships
interface Incident {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

interface IncidentRelationship {
  id: string;
  sourceIncidentId: string;
  targetIncidentId: string;
  relationshipType: 'related' | 'duplicate' | 'blocks' | 'blocked_by' | 'parent' | 'child' | 'caused_by' | 'causes';
  similarityScore: number;
  createdAt: Date;
  createdBy: string;
  notes?: string;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  incident: Incident;
  type: 'main' | 'related';
  level: number;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  relationship: IncidentRelationship;
  strength: number;
}

interface RelationshipGraphData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

interface IncidentRelationshipViewerProps {
  incidentId: string;
  onIncidentSelect?: (incidentId: string) => void;
  onRelationshipCreate?: (relationship: Partial<IncidentRelationship>) => void;
  onRelationshipDelete?: (relationshipId: string) => void;
  maxDepth?: number;
  showSimilarityScores?: boolean;
}

// Relationship type configurations
const RELATIONSHIP_TYPES = [
  { value: 'related', label: 'Related', description: 'General relationship', color: '#3b82f6', icon: Link2 },
  { value: 'duplicate', label: 'Duplicate', description: 'Identical or very similar incident', color: '#f59e0b', icon: GitBranch },
  { value: 'blocks', label: 'Blocks', description: 'This incident blocks another', color: '#ef4444', icon: AlertTriangle },
  { value: 'blocked_by', label: 'Blocked By', description: 'This incident is blocked by another', color: '#ef4444', icon: AlertTriangle },
  { value: 'parent', label: 'Parent', description: 'Parent incident', color: '#8b5cf6', icon: ChevronDown },
  { value: 'child', label: 'Child', description: 'Child incident', color: '#8b5cf6', icon: ChevronRight },
  { value: 'caused_by', label: 'Caused By', description: 'This incident was caused by another', color: '#dc2626', icon: AlertTriangle },
  { value: 'causes', label: 'Causes', description: 'This incident causes another', color: '#dc2626', icon: AlertTriangle }
];

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
};

const STATUS_COLORS = {
  open: '#6b7280',
  in_progress: '#3b82f6',
  resolved: '#22c55e',
  closed: '#059669'
};

export const IncidentRelationshipViewer: React.FC<IncidentRelationshipViewerProps> = ({
  incidentId,
  onIncidentSelect,
  onRelationshipCreate,
  onRelationshipDelete,
  maxDepth = 3,
  showSimilarityScores = true
}) => {
  const [graphData, setGraphData] = useState<RelationshipGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Incident[]>([]);
  const [selectedRelationshipType, setSelectedRelationshipType] = useState<string>('related');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'tree' | 'list'>('graph');
  const [filterType, setFilterType] = useState<string>('all');

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load relationship data
  const loadRelationshipData = useCallback(async () => {
    setLoading(true);
    try {
      // Mock API call - replace with actual service
      const mockData = await generateMockRelationshipData(incidentId, maxDepth);
      setGraphData(mockData);
    } catch (error) {
      console.error('Failed to load relationship data:', error);
    } finally {
      setLoading(false);
    }
  }, [incidentId, maxDepth]);

  useEffect(() => {
    loadRelationshipData();
  }, [loadRelationshipData]);

  // Generate mock relationship data
  const generateMockRelationshipData = async (rootIncidentId: string, depth: number): Promise<RelationshipGraphData> => {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    // Create root incident
    const rootIncident: Incident = {
      id: rootIncidentId,
      title: 'DB2 Connection Pool Exhaustion',
      category: 'DB2',
      severity: 'high',
      status: 'in_progress',
      assignedTo: 'john.doe',
      createdAt: new Date('2024-01-15T10:30:00'),
    };

    nodes.push({
      id: rootIncidentId,
      incident: rootIncident,
      type: 'main',
      level: 0
    });

    // Generate related incidents at different levels
    const incidentCategories = ['DB2', 'JCL', 'CICS', 'Batch', 'Network'];
    const severities: ('critical' | 'high' | 'medium' | 'low')[] = ['critical', 'high', 'medium', 'low'];
    const statuses: ('open' | 'in_progress' | 'resolved' | 'closed')[] = ['open', 'in_progress', 'resolved', 'closed'];

    let idCounter = 1;

    for (let level = 1; level <= depth; level++) {
      const numIncidents = Math.max(5 - level, 1); // Fewer incidents at deeper levels

      for (let i = 0; i < numIncidents; i++) {
        const incidentId = `INC-${String(idCounter).padStart(4, '0')}`;
        idCounter++;

        const incident: Incident = {
          id: incidentId,
          title: generateMockIncidentTitle(),
          category: incidentCategories[Math.floor(Math.random() * incidentCategories.length)],
          severity: severities[Math.floor(Math.random() * severities.length)],
          status: statuses[Math.floor(Math.random() * statuses.length)],
          assignedTo: ['john.doe', 'jane.smith', 'bob.wilson', 'alice.brown'][Math.floor(Math.random() * 4)],
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
        };

        const node: NetworkNode = {
          id: incidentId,
          incident,
          type: 'related',
          level
        };

        nodes.push(node);

        // Create relationship to previous level
        const sourceLevel = Math.max(0, level - 1);
        const possibleSources = nodes.filter(n => n.level === sourceLevel);
        const sourceNode = possibleSources[Math.floor(Math.random() * possibleSources.length)];

        const relationshipTypes = RELATIONSHIP_TYPES.map(rt => rt.value);
        const relationshipType = relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)] as any;

        const relationship: IncidentRelationship = {
          id: `REL-${String(links.length + 1).padStart(4, '0')}`,
          sourceIncidentId: sourceNode.id,
          targetIncidentId: incidentId,
          relationshipType,
          similarityScore: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
          createdAt: new Date(),
          createdBy: 'system',
          notes: Math.random() > 0.7 ? 'Auto-detected similarity' : undefined
        };

        const link: NetworkLink = {
          source: sourceNode.id,
          target: incidentId,
          relationship,
          strength: relationship.similarityScore
        };

        links.push(link);
      }
    }

    return { nodes, links };
  };

  const generateMockIncidentTitle = (): string => {
    const prefixes = ['DB2', 'JCL', 'CICS', 'Batch', 'Network', 'System'];
    const issues = [
      'Connection timeout',
      'Memory leak detected',
      'Performance degradation',
      'Authentication failure',
      'Transaction deadlock',
      'Resource unavailable',
      'Configuration error',
      'Service outage',
      'Data corruption',
      'Process hanging'
    ];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const issue = issues[Math.floor(Math.random() * issues.length)];

    return `${prefix} ${issue}`;
  };

  // D3.js network visualization
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();

    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create simulation
    const simulation = d3.forceSimulation<NetworkNode>(graphData.nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(graphData.links)
        .id(d => d.id)
        .distance(d => 100 / (d.strength || 0.5))
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .enter().append('line')
      .attr('stroke', d => RELATIONSHIP_TYPES.find(rt => rt.value === d.relationship.relationshipType)?.color || '#999')
      .attr('stroke-width', d => Math.max(1, d.strength * 3))
      .attr('stroke-opacity', 0.6);

    // Create link labels (relationship types)
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(graphData.links)
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text(d => d.relationship.relationshipType);

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.type === 'main' ? 15 : 10)
      .attr('fill', d => SEVERITY_COLORS[d.incident.severity])
      .attr('stroke', d => STATUS_COLORS[d.incident.status])
      .attr('stroke-width', d => d.type === 'main' ? 3 : 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
        onIncidentSelect?.(d.incident.id);
      });

    // Add node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '8px')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text(d => d.incident.id.split('-')[1] || d.incident.id.slice(-4));

    // Add tooltips
    node.append('title')
      .text(d => `${d.incident.title}\nSeverity: ${d.incident.severity}\nStatus: ${d.incident.status}`);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, onIncidentSelect]);

  // Search for incidents to link
  const searchIncidents = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Mock search - replace with actual API call
    const mockResults: Incident[] = [
      {
        id: 'INC-1001',
        title: 'DB2 Connection Timeout in Batch Process',
        category: 'DB2',
        severity: 'high',
        status: 'open',
        createdAt: new Date('2024-01-16T14:20:00'),
      },
      {
        id: 'INC-1002',
        title: 'JCL Step Failure in PAYROLL Job',
        category: 'JCL',
        severity: 'medium',
        status: 'in_progress',
        createdAt: new Date('2024-01-16T16:45:00'),
      },
      {
        id: 'INC-1003',
        title: 'CICS Transaction ABEND-0C4',
        category: 'CICS',
        severity: 'critical',
        status: 'open',
        createdAt: new Date('2024-01-17T09:15:00'),
      }
    ].filter(incident =>
      incident.title.toLowerCase().includes(query.toLowerCase()) ||
      incident.id.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(mockResults);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => searchIncidents(searchQuery), 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchIncidents]);

  const handleCreateRelationship = (targetIncident: Incident) => {
    const relationship: Partial<IncidentRelationship> = {
      sourceIncidentId: incidentId,
      targetIncidentId: targetIncident.id,
      relationshipType: selectedRelationshipType as any,
      similarityScore: 0.8, // Default score
      createdBy: 'user',
      notes: 'Manually linked'
    };

    onRelationshipCreate?.(relationship);
    setIsCreateDialogOpen(false);
    setSearchQuery('');
    setSearchResults([]);

    // Reload data
    loadRelationshipData();
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    onRelationshipDelete?.(relationshipId);
    loadRelationshipData();
  };

  const filteredLinks = useMemo(() => {
    if (!graphData || filterType === 'all') return graphData?.links || [];
    return graphData.links.filter(link => link.relationship.relationshipType === filterType);
  }, [graphData, filterType]);

  const relationshipTypeConfig = RELATIONSHIP_TYPES.find(rt => rt.value === selectedRelationshipType);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading relationship data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-6' : ''}`}>
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Incident Relationships</h3>
          {graphData && (
            <Badge variant="secondary">
              {graphData.nodes.length} incidents, {graphData.links.length} relationships
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="graph">Graph</SelectItem>
              <SelectItem value="tree">Tree</SelectItem>
              <SelectItem value="list">List</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {RELATIONSHIP_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Link Incident
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadRelationshipData}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Visualization */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              {viewMode === 'graph' && (
                <div
                  ref={containerRef}
                  className="relative w-full h-96 bg-gray-50 border rounded-lg overflow-hidden"
                >
                  <svg
                    ref={svgRef}
                    className="w-full h-full"
                  />

                  {/* Legend */}
                  <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-sm border">
                    <h4 className="text-sm font-semibold mb-2">Legend</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-600"></div>
                        <span>Critical</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-orange-600"></div>
                        <span>High</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-yellow-600"></div>
                        <span>Medium</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600"></div>
                        <span>Low</span>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-sm border">
                    <div className="text-xs text-gray-600">
                      <p>Drag nodes to reposition</p>
                      <p>Scroll to zoom</p>
                      <p>Click nodes for details</p>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'list' && (
                <div className="p-4">
                  <div className="space-y-3">
                    {filteredLinks.map(link => (
                      <div key={link.relationship.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{(link.source as NetworkNode).incident.id}</Badge>
                            <span className="text-sm text-gray-500">→</span>
                            <Badge variant="outline">{(link.target as NetworkNode).incident.id}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge style={{ backgroundColor: RELATIONSHIP_TYPES.find(rt => rt.value === link.relationship.relationshipType)?.color }}>
                              {link.relationship.relationshipType}
                            </Badge>
                            {showSimilarityScores && (
                              <span className="text-xs text-gray-500">
                                {Math.round(link.relationship.similarityScore * 100)}% similarity
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRelationship(link.relationship.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected Node Details */}
          {selectedNode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Selected Incident</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{selectedNode.incident.id}</p>
                  <p className="text-sm text-gray-600">{selectedNode.incident.title}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{selectedNode.incident.category}</Badge>
                  <Badge style={{ backgroundColor: SEVERITY_COLORS[selectedNode.incident.severity] }}>
                    {selectedNode.incident.severity}
                  </Badge>
                  <Badge style={{ backgroundColor: STATUS_COLORS[selectedNode.incident.status] }}>
                    {selectedNode.incident.status}
                  </Badge>
                </div>
                {selectedNode.incident.assignedTo && (
                  <p className="text-sm text-gray-600">
                    Assigned to: {selectedNode.incident.assignedTo}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onIncidentSelect?.(selectedNode.incident.id)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Relationship Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Relationship Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {RELATIONSHIP_TYPES.map(type => {
                const count = graphData?.links.filter(link => link.relationship.relationshipType === type.value).length || 0;
                return (
                  <div key={type.value} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: type.color }}
                      />
                      <span>{type.label}</span>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Relationship Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Related Incident</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Relationship Type Selection */}
            <div>
              <label className="text-sm font-medium">Relationship Type</label>
              <Select value={selectedRelationshipType} onValueChange={setSelectedRelationshipType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                        <span className="text-xs text-gray-500">- {type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {relationshipTypeConfig && (
                <p className="text-xs text-gray-600 mt-1">{relationshipTypeConfig.description}</p>
              )}
            </div>

            {/* Search for Incidents */}
            <div>
              <label className="text-sm font-medium">Search Incidents</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by ID or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map(incident => (
                  <div
                    key={incident.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => handleCreateRelationship(incident)}
                  >
                    <div>
                      <p className="font-medium">{incident.id}</p>
                      <p className="text-sm text-gray-600">{incident.title}</p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">{incident.category}</Badge>
                        <Badge style={{ backgroundColor: SEVERITY_COLORS[incident.severity] }} className="text-xs">
                          {incident.severity}
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm">
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No incidents found matching "{searchQuery}"
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentRelationshipViewer;