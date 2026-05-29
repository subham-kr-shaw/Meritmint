export interface Credential {
  id: number;
  admin: string;
  student: string;
  studentName: string;
  course: string;
  issueDate: string;
  issuedAtLedger: number;
}

export interface ContractSnapshot {
  isInitialized: boolean;
  admin: string | null;
  institution: string | null;
  totalCredentials: number;
}

export interface WriteResult {
  hash: string;
  result: unknown;
}
