const API_URL = import.meta.env.VITE_API_URL.replace(/\/$/, '');
const UPLOAD_URL = `${API_URL}/upload/image`;

export const UploadAPI = {
  async uploadImage(fileOrBlob: Blob | File, filename?: string): Promise<string> {
    const formData = new FormData();
    if (filename) {
      formData.append('image', fileOrBlob, filename);
    } else {
      formData.append('image', fileOrBlob);
    }

    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      throw new Error('File upload failed');
    }
    
    const data = await res.json();
    return data.url;
  }
};
