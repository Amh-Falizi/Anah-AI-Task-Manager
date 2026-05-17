export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "dev_front" | "dev_back";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string;
  assigneeId: string | null;
  creatorId: string;
  branchName: string | null;
  createdAt: string;
  parentId?: string | null;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
}

export interface TeamMember extends User {
  teamId: string;
  joinedAt: string;
}
