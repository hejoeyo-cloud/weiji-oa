import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, User, Building2 } from 'lucide-react'
import { getDepartments } from '../api/departments'
import { getUsers } from '../api/users'

interface TreeNode {
  id: number; name: string; type: 'dept' | 'user'; children?: TreeNode[]
}

export default function OrgTreePicker({ onSelect, selectedIds }: {
  onSelect: (userId: number, userName: string) => void
  selectedIds: number[]
}) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const depts = (await getDepartments()) as any[]
        const userRes = await getUsers()
        const users = (userRes.data || userRes || []) as any[]

        const deptNodes: TreeNode[] = depts.map((d: any) => ({
          id: d.id, name: d.name, type: 'dept' as const, children: []
        }))
        const userNodes: TreeNode[] = users.map((u: any) => ({
          id: u.id, name: u.name, type: 'user' as const,
          department_id: u.department_id
        }))

        // Build tree
        const root: TreeNode[] = []
        const deptMap = new Map<number, TreeNode>()
        for (const d of deptNodes) { deptMap.set(d.id, d); root.push(d) }
        
        // Add users to their departments
        for (const u of userNodes) {
          const dept = deptMap.get((u as any).department_id)
          if (dept && dept.children) {
            dept.children!.push(u)
          } else {
            root.push(u)
          }
        }

        setTree(root)
        setExpanded(new Set(deptNodes.map(d => d.id)))
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  const toggle = (id: number) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expanded.has(node.id)
    const isUser = node.type === 'user'
    const isSelected = selectedIds.includes(node.id)

    return (
      <div key={`${node.type}-${node.id}`}>
        <div
          onClick={() => {
            if (node.type === 'dept') toggle(node.id)
            else onSelect(node.id, node.name)
          }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
            isUser ? 'hover:bg-blue-50' : 'hover:bg-gray-50'
          } ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {node.type === 'dept' ? (
            <>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Building2 size={14} className="text-gray-400" /></>
          ) : (
            <User size={14} className="text-gray-400 ml-5" />
          )}
          <span className={isUser ? '' : 'font-medium'}>{node.name}</span>
          {isSelected && <span className="ml-auto text-[10px] text-blue-600">已选</span>}
        </div>
        {node.children && isExpanded && (
          <div>{node.children.map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  if (loading) return <div className="text-xs text-gray-400 p-2">加载中...</div>

  return (
    <div className="border rounded-lg max-h-64 overflow-auto" style={{ borderColor: '#e5e5e5' }}>
      {tree.map(n => renderNode(n))}
    </div>
  )
}
