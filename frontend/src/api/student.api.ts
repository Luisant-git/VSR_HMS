const API_URL = import.meta.env.VITE_API_URL;

export interface CreateStudentDto {
  regNo?: string;
  name: string;
  dob?: string;
  age?: number;
  gender?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  emailId?: string;
  mobileNo?: string;
  fatherName?: string;
  fatherMobileNo?: string;
  motherName?: string;
  motherMobileNo?: string;
  guardianName?: string;
  guardianMobileNo?: string;
  aadharNo?: string;
  secondaryIdNo?: string;
  address?: string;
  college?: string;
  educationalQua?: string;
  courseDuration?: string;
  pursuingYear?: string;
  vsrLedger1?: string;
  dateOfJoining?: string;
  category?: string;
  foodType?: string;
  roomNo?: string;
  bedNo?: string;
  advance?: number;
  rent?: number;
  messFee?: number;
  autoGenerateInvoice?: boolean;
  photoUrl?: string;
  doc1Url?: string;
  doc2Url?: string;
}

export const StudentAPI = {
  async create(data: CreateStudentDto) {
    const res = await fetch(`${API_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create student');
    }
    return res.json();
  },

  async findAll() {
    const res = await fetch(`${API_URL}/students`);
    if (!res.ok) throw new Error('Failed to fetch students');
    return res.json();
  },

  async findOne(id: string) {
    const res = await fetch(`${API_URL}/students/${id}`);
    if (!res.ok) throw new Error('Failed to fetch student');
    return res.json();
  },

  async update(id: string, data: any) {
    const res = await fetch(`${API_URL}/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to update student');
    }
    return res.json();
  },

  async triggerFines() {
    const res = await fetch(`${API_URL}/students/actions/trigger-fines`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to trigger fines');
    return res.json();
  }
};
