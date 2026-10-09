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
  manualRegsiName?: string;
  isImport?: boolean;
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

  async findByMobile(mobileNo: string) {
    const res = await fetch(`${API_URL}/students/mobile/${mobileNo}`);
    if (!res.ok) throw new Error('Failed to fetch student by mobile');
    return res.json();
  },

  async getNextRegsiName() {
    const res = await fetch(`${API_URL}/students/next-regsi`);
    if (!res.ok) throw new Error('Failed to fetch next regsi name');
    return res.json();
  },

  async findAll(params?: { page?: number; limit?: number; search?: string; roomFilter?: string; collegeFilter?: string; sortFilter?: string; feeFilter?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.roomFilter) query.append('roomFilter', params.roomFilter);
    if (params?.collegeFilter) query.append('collegeFilter', params.collegeFilter);
    if (params?.sortFilter) query.append('sortFilter', params.sortFilter);
    if (params?.feeFilter) query.append('feeFilter', params.feeFilter);
    
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_URL}/students${queryString}`);
    if (!res.ok) throw new Error('Failed to fetch students');
    const json = await res.json();
    
    // Return full paginated object if pagination was requested
    if (params?.page || params?.limit) {
      return json;
    }
    // Otherwise return just the array for backwards compatibility
    return json.data || json;
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
