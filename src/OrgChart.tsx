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

export default function GPTChart() {
    const [nodes, setNodes] = useState<any[]>([]);
    const [edges, setEdges] = useState<any[]>([]);
    const [expandedNodes, setExpandedNodes] = useState(new Set());

    useEffect(() => {
        fetchAndExpandNode();
    }, []);

    const addNodeAndEdges = (node, reports) => {
        const { name, ...restNode } = node
        const mainNode = {
            id: `${node.id}`,
            data: { label: name, ...restNode },
            position: node.level === 0 ? { x: 0, y: 0 } : undefined,
        };

        const newNodes: any = [mainNode];
        const newEdges: any[] = [];

        // Add each report node and its edge
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
        if (nodeId && expandedNodes.has(nodeId)) return; // Skip if already expanded

        const data = await fetchNodeData(nodeId);
        if (nodeId) {
            addNodeAndEdges(data.person, data.reports);
            setExpandedNodes((prev) => new Set(prev).add(nodeId));
        } else {
            // Initial fetch: CEO and direct reports
            addNodeAndEdges(data.ceo, data.reports);
        }
    };

    const collapseNode = (nodeId) => {
        // Recursive function to find all descendants of a node
        const findDescendants = (parentId) => {
            const children = nodes.filter(node => node.parent_id === parentId);
            let allDescendants = [...children];

            children.forEach(child => {
                allDescendants = [...allDescendants, ...findDescendants(child.id)];
            });

            return allDescendants;
        };

        const descendants = findDescendants(nodeId).map(node => node.id);

        // Filter out child nodes and edges of the collapsed node
        setNodes((prevNodes) =>
            prevNodes.filter((node) => !descendants.includes(node.id))
        );
        setEdges((prevEdges) =>
            prevEdges.filter((edge) => !descendants.includes(edge.target))
        );

        setExpandedNodes((prev) => {
            const newExpandedNodes = new Set(prev);
            newExpandedNodes.delete(nodeId); // Remove node from expanded set
            return newExpandedNodes;
        });
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
            newExpandedNodes.delete(currentNodeID); // Remove node from expanded set
            return newExpandedNodes;
        });
    };


    const onNodeClick = (event, node) => {
        if (expandedNodes.has(node.id)) {
            nodeClick(node)
        } else {
            // Expand and fetch new children if node is not expanded
            fetchAndExpandNode(node.id);
        }
    };


    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
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
