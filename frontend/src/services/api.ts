import axios from "axios";
import { loadConfig } from "../config/constants";
import {
  Family,
  GraphData,
  Member,
  ParentChildRelationship,
  Region,
  SpouseRelationship,
  User,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Initialize config
loadConfig().then((config) => {
  if (config && config.apiBaseUrl) {
    api.defaults.baseURL = config.apiBaseUrl;
    console.log("Loaded API Base URL from config:", config.apiBaseUrl);
  }
});

export const getMembers = async (familyId: string) => {
  const response = await api.get<Member[]>(`/members/?family_id=${familyId}`);
  return response.data;
};

export const createMember = async (
  member: Omit<Member, "id" | "created_at" | "updated_at">,
) => {
  const response = await api.post<Member>("/members/", member);
  return response.data;
};

export const updateMember = async (id: string, member: Partial<Member>) => {
  const response = await api.put<Member>(`/members/${id}`, member);
  return response.data;
};

export const deleteMember = async (id: string) => {
  const response = await api.delete(`/members/${id}`);
  return response.data;
};

export const deleteMembers = async (ids: string[]) => {
  const response = await api.delete("/members/", {
    data: { member_ids: ids },
  });
  return response.data;
};

export const getFamilyGraph = async (familyId: string) => {
  const response = await api.get<GraphData>(`/relationships/graph/${familyId}`);
  return response.data;
};

export const getFamilyStats = async (familyId: string) => {
  const response = await api.get<{ member_count: number }>(
    `/members/count?family_id=${familyId}`,
  );
  // If backend doesn't have this endpoint yet, we might need to fetch members and count length.
  // But let's assume we can add it or just use getMembers().length for now since data is small.
  return response.data;
};

export const createSpouseRelationship = async (
  member1Id: string,
  member2Id: string,
) => {
  const response = await api.post<SpouseRelationship>("/relationships/spouse", {
    member1_id: member1Id,
    member2_id: member2Id,
  });
  return response.data;
};

export const createParentChildRelationship = async (
  parentId: string,
  childId: string,
  type: "father" | "mother",
) => {
  const response = await api.post<ParentChildRelationship>(
    "/relationships/parent-child",
    {
      parent_id: parentId,
      child_id: childId,
      relationship_type: type,
    },
  );
  return response.data;
};

export const deleteSpouseRelationship = async (id: string) => {
  const response = await api.delete(`/relationships/spouse/${id}`);
  return response.data;
};

export const updateSpouseRelationship = async (
  id: string,
  data: { marriage_date?: string },
) => {
  const response = await api.put<SpouseRelationship>(
    `/relationships/spouse/${id}`,
    data,
  );
  return response.data;
};

export const deleteParentChildRelationship = async (id: string) => {
  const response = await api.delete(`/relationships/parent-child/${id}`);
  return response.data;
};

export const getFamilyName = async (familyId: string) => {
  try {
    const response = await api.get<{ family_name: string }>(
      `/families/${familyId}/name`,
    );
    return response.data.family_name;
  } catch {
    return null;
  }
};

export const getFamily = async (familyId: string, userId?: string) => {
  const url = userId
    ? `/families/${familyId}?user_id=${userId}`
    : `/families/${familyId}`;
  const response = await api.get<Family>(url);
  return response.data;
};
export const getFamilies = async (userId?: string) => {
  // If userId is provided, we might want to filter.
  // Currently backend reads user_id from query param to filter for My Families + Shared.
  // If not provided, it returns all (for admin).
  // But wait, the updated backend `read_families` takes `user_id` as query param.
  const url = userId ? `/families/?user_id=${userId}` : "/families/";
  const response = await api.get<Family[]>(url);
  return response.data;
};

export const inviteCollaborator = async (
  familyId: string,
  email: string,
  role: "viewer" | "editor" | "admin",
) => {
  const response = await api.post(`/families/${familyId}/invite`, {
    email,
    role,
  });
  return response.data;
};

export const updateCollaboratorRole = async (
  familyId: string,
  userId: string,
  role: "viewer" | "editor" | "admin",
) => {
  const response = await api.put(
    `/families/${familyId}/collaborators/${userId}`,
    { role },
  );
  return response.data;
};

export const getCollaborators = async (familyId: string) => {
  const response = await api.get(`/families/${familyId}/collaborators`);
  return response.data;
};

export const removeCollaborator = async (familyId: string, userId: string) => {
  const response = await api.delete(
    `/families/${familyId}/collaborators/${userId}`,
  );
  return response.data;
};

export const createFamily = async (
  name: string,
  userId: string,
  description?: string,
) => {
  const response = await api.post<Family>("/families/", {
    family_name: name,
    user_id: userId,
    description,
  });
  return response.data;
};

export const updateFamily = async (
  id: string,
  name: string,
  description?: string,
) => {
  const response = await api.put<Family>(`/families/${id}`, {
    family_name: name,
    description,
  });
  return response.data;
};

export interface ImportMember extends Omit<
  Member,
  "id" | "created_at" | "updated_at"
> {
  original_id?: string;
  // Allow other properties just in case
  [key: string]: unknown;
}

export interface ImportSpouseRelationship {
  member1_original_id: string;
  member2_original_id: string;
  marriage_date?: string;
}

export interface ImportParentChildRelationship {
  parent_original_id: string;
  child_original_id: string;
  relationship_type: string;
}

export interface ImportRegion {
  name: string;
  description?: string;
  color?: string;
  linked_family_id?: string;
  original_id: string;
}

export interface ImportData {
  family_name: string;
  user_id?: string;
  members: ImportMember[];
  spouse_relationships: ImportSpouseRelationship[];
  parent_child_relationships: ImportParentChildRelationship[];
  regions?: ImportRegion[];
  [key: string]: unknown;
}

export const importFamily = async (data: ImportData, userId?: string) => {
  // If userId is provided, pass it as query param to override ownership
  const url = userId
    ? `/families/import?user_id=${userId}`
    : "/families/import";
  const response = await api.post<Family>(url, data);
  return response.data;
};

export const importFamilyPreset = async (key: string, userId: string) => {
  // Ideally we should pass userId in body, but the backend endpoint uses query param.
  // Let's stick to query param for now, but ensure we pass it correctly.
  const response = await api.post<Family>(
    `/families/import-preset/${key}?user_id=${userId}`,
  );
  return response.data;
};

export const deleteFamily = async (id: string) => {
  const response = await api.delete<Family>(`/families/${id}`);
  return response.data;
};

export const loginUser = async (
  email: string,
  password: string = "password",
) => {
  // For demo, we default password if not provided or just send what user typed
  // The backend expects password to match.
  // In our createUser helper we set password='password'.
  try {
    const response = await api.post<User>("/users/login", { email, password });
    return response.data;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

export const registerUser = async (
  email: string,
  name: string,
  password: string = "password",
) => {
  try {
    const response = await api.post<User>("/users/", { email, name, password });
    return response.data;
  } catch (error) {
    console.error("Registration failed", error);
    throw error;
  }
};

export const createUser = async (email: string, name: string) => {
  // This is just a helper for demo setup
  try {
    const response = await api.post<User>("/users/", {
      email,
      name,
      password: "password",
    });
    return response.data;
  } catch (error) {
    // Assume user exists or handle error
    console.error("User creation failed (might exist)", error);
    return null;
  }
};

export const getUsers = async () => {
  const response = await api.get<User[]>("/users/");
  return response.data;
};

export const getUser = async (id: string) => {
  const response = await api.get<User>(`/users/${id}`);
  return response.data;
};

export const deleteUser = async (id: string) => {
  const response = await api.delete<User>(`/users/${id}`);
  return response.data;
};

export const updateUserRole = async (id: string, isSuperuser: boolean) => {
  const response = await api.put<User>(`/users/${id}/role`, {
    is_superuser: isSuperuser,
  });
  return response.data;
};

// Access Requests
export const createAccessRequest = async (familyId: string, userId: string) => {
  const response = await api.post(
    "/families/" + familyId + "/access-requests",
    { family_id: familyId, user_id: userId },
  );
  return response.data;
};

export const getPendingAccessRequests = async (userId: string) => {
  const response = await api.get(
    "/families/access-requests/pending?user_id=" + userId,
  );
  return response.data;
};

export const approveAccessRequest = async (requestId: string) => {
  const response = await api.put(
    `/families/access-requests/${requestId}/approve`,
  );
  return response.data;
};

export const rejectAccessRequest = async (requestId: string) => {
  const response = await api.put(
    `/families/access-requests/${requestId}/reject`,
  );
  return response.data;
};

// Regions
export const createRegion = async (
  familyId: string,
  name: string,
  description?: string,
  memberIds?: string[],
  color?: string,
  linkedFamilyId?: string,
) => {
  const response = await api.post<Region>("/regions/", {
    family_id: familyId,
    name,
    description,
    member_ids: memberIds,
    color,
    linked_family_id: linkedFamilyId,
  });
  return response.data;
};

export const updateRegion = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    member_ids?: string[];
    color?: string;
    linked_family_id?: string;
  },
) => {
  const response = await api.put<Region>(`/regions/${id}`, data);
  return response.data;
};

export const deleteRegion = async (id: string) => {
  const response = await api.delete(`/regions/${id}`);
  return response.data;
};

export const getRegions = async (familyId: string) => {
  const response = await api.get<Region[]>(`/regions/family/${familyId}`);
  return response.data;
};

export default api;
