export interface Family {
  id: string;
  user_id: string;
  family_name: string;
  description?: string;
  created_at: string;
  current_user_role?: 'owner' | 'editor' | 'viewer' | 'admin';
}

export interface FamilyCollaborator {
    family_id: string;
    user_id: string;
    role: 'viewer' | 'editor' | 'admin';
    created_at: string;
    user?: User;
    family?: Family;
}

export interface AccessRequest {
    id: string;
    family_id: string;
    user_id: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    user?: User;
    family?: Family;
}

export interface User {
  id: string;
  name: string;
  email: string;
  is_superuser: boolean;
  created_at?: string;
  families?: Family[];
  shared_families?: FamilyCollaborator[];
}

export interface Member {
  id: string;
  family_id: string;
  name: string;
  surname?: string; // 姓
  gender: 'male' | 'female';
  birth_date?: string;
  death_date?: string;
  is_deceased?: boolean; // 是否已逝世 (无具体日期时使用)
  is_fuzzy?: boolean; // 是否为模糊节点
  remark?: string; // 备注
  birth_place?: string;
  photo_url?: string;
  position_x: number;
  position_y: number;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface SpouseRelationship {
  id: string;
  member1_id: string;
  member2_id: string;
  marriage_date?: string;
  created_at: string;
}

export interface ParentChildRelationship {
  id: string;
  parent_id: string;
  child_id: string;
  relationship_type: 'father' | 'mother';
  created_at: string;
}

export interface GraphNode {
  id: string;
  name: string;
  gender: string;
  x: number;
  y: number;
  data: Member;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
