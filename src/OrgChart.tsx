import React, { useEffect, useState } from 'react';
import {
    Background, ConnectionLineType, Controls, MiniMap, ReactFlow,
    getConnectedEdges,
    getOutgoers,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

const nodeWidth = 200;
const nodeHeight = 140;

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const fetchNodeData = async (id) => {
    const url = id
        ? `https://xbowadyscetrgioxnunx.supabase.co/functions/v1/fetchEmployees/${id}`
        : `https://xbowadyscetrgioxnunx.supabase.co/functions/v1/fetchEmployees/`;
    const response = await fetch(url);
    return response.json();
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
            targetPosition: 'top',
            sourcePosition: 'bottom',
        };
    });

    return { nodes: newNodes, edges };
};

export default function OrgChart() {
    const [nodes, setNodes] = useState<any[]>([]);
    const [edges, setEdges] = useState<any[]>([]);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

    useEffect(() => {
        fetchAndExpandNode();
    }, []);

    const addNodeAndEdges = (node, reports) => {
        const { name, ...restNode } = node
        const mainNode = {
            id: `${node.id}`,
            data: { label: loadingNodeId === node.id ? 'Loading...' : name, ...restNode },
            position: node.level === 0 ? { x: 0, y: 0 } : undefined,
        };

        const newNodes: any = [mainNode];
        const newEdges: any[] = [];

        reports.forEach((report) => {
            const { name, ...restReport } = report
            newNodes.push({
                id: `${report.id}`,
                data: { label: name, ...restReport },
                position: { x: 0, y: 0 }
            });

            newEdges.push({
                id: `e${report.id}-${report.parent_id}`,
                source: `${report.parent_id}`,
                target: `${report.id}`,
                type: 'smoothstep'
            });
        });

        setNodes((prevNodes) => [...prevNodes, ...newNodes]);
        setEdges((prevEdges) => [...prevEdges, ...newEdges]);
    };

    const fetchAndExpandNode = async (nodeId?: string) => {
        if (nodeId && expandedNodes.has(nodeId)) return;
        setLoadingNodeId(nodeId || 'root');
        const data = await fetchNodeData(nodeId);
        if (nodeId) {
            addNodeAndEdges(data.person, data.reports);
            setExpandedNodes((prev) => new Set(prev).add(nodeId));
        } else {
            addNodeAndEdges(data.ceo, data.reports);
        }

        setLoadingNodeId(null);
    };

    const hide = (hidden, childEdgeID, childNodeID) => (nodeOrEdge) => {
        if (
            childEdgeID.includes(nodeOrEdge.id) ||
            childNodeID.includes(nodeOrEdge.id)
        )
            nodeOrEdge.hidden = hidden;
        return nodeOrEdge;
    };

    const checkTarget = (edge, id) => {
        let edges = edge.filter((ed) => {
            return ed.target !== id;
        });
        return edges;
    };

    let outgoers: any[] = [];
    let connectedEdges: any[] = [];
    let stack: any[] = [];

    const nodeClick = (node) => {
        let currentNodeID = node.id;
        stack.push(node);
        while (stack.length > 0) {
            let lastNOde = stack.pop();
            let childnode = getOutgoers(lastNOde, nodes, edges);
            let childedge = checkTarget(
                getConnectedEdges([lastNOde], edges),
                currentNodeID
            );
            childnode.map((goer, key) => {
                stack.push(goer);
                outgoers.push(goer);
            });
            childedge.map((edge, key) => {
                connectedEdges.push(edge);
            });
        }

        let childNodeID = outgoers.map((node) => {
            return node.id;
        });
        let childEdgeID = connectedEdges.map((edge) => {
            return edge.id;
        });

        setNodes((node) => node.map(hide(true, childEdgeID, childNodeID)));
        setEdges((edge) => edge.map(hide(true, childEdgeID, childNodeID)));
        setExpandedNodes((prev) => {
            const newExpandedNodes = new Set(prev);
            newExpandedNodes.delete(currentNodeID);
            return newExpandedNodes;
        });
    };


    const onNodeClick = (event, node) => {
        if (expandedNodes.has(node.id)) {
            nodeClick(node)
        } else {
            fetchAndExpandNode(node.id);
        }
    };


    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                label: loadingNodeId === node.id ? 'Loading...' : node.data.label,
            }
        })),
        edges
    );

    return (
        <div style={{ width: '100%', height: '95vh' }}>
            <ReactFlow
                nodes={layoutedNodes}
                edges={layoutedEdges}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView
                onNodeClick={onNodeClick}
            >
                <Background />
                <MiniMap />
                <Controls />
            </ReactFlow>
        </div>
    );
}
