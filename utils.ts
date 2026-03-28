
export const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const calculateFine = (amount: number, dueDateStr: string, fineRate = 0.001): number => {
  const [d, m, y] = dueDateStr.split('/').map(Number);
  const dueDate = new Date(y, m - 1, d);
  const today = new Date();
  
  // Set time to midnight for accurate day comparison
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  if (today <= dueDate) return 0;
  
  const diffTime = Math.abs(today.getTime() - dueDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;

  // fineRate is now passed as an argument, defaulting to 0.001 (0.1%)
  let fine = amount * fineRate * diffDays;
  
  const maxFine = amount * 0.3; // 30% cap
  const finalFine = Math.min(fine, maxFine);
  return Math.ceil(finalFine / 1000) * 1000;
};

/**
 * Sinh mã hợp đồng duy nhất dựa trên định dạng cấu hình
 * Mặc định: HD-{RANDOM}
 */
export const generateContractId = (userId: string, format = 'HD-{RANDOM}'): string => {
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  const userPart = userId.slice(-4).toUpperCase();
  
  return format
    .replace(/\{RANDOM\}|\{RANDOM 4 SỐ\}|\{MÃ NGẪU NHIÊN\}|\{Mã Hợp Đồng\}/gi, randomPart)
    .replace(/\{USER\}|\{MÃ USER\}|\{NGƯỜI DÙNG\}/gi, userPart);
};

/**
 * Sinh ID User duy nhất dựa trên định dạng cấu hình
 * Mặc định: US-{RANDOM}
 */
export const generateUserId = (format = 'US-{RANDOM}'): string => {
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  
  return format.replace(/\{RANDOM\}|\{RANDOM 4 SỐ\}|\{MÃ NGẪU NHIÊN\}/gi, randomPart);
};

/**
 * Tải ảnh lên ImgBB để tiết kiệm dung lượng Supabase
 * @param base64Data Dữ liệu ảnh dạng base64 (bao gồm cả prefix data:image/...)
 * @param name Tên ảnh (tùy chọn)
 * @returns URL ảnh đã tải lên
 */
export const uploadToImgBB = async (base64Data: string, name?: string, customApiKey?: string): Promise<string> => {
  // Đảm bảo lấy API Key từ đúng nguồn: Ưu tiên customApiKey từ settings, sau đó là env
  const apiKey = customApiKey || import.meta.env.VITE_IMGBB_API_KEY;
  
  // Kiểm tra API Key hợp lệ (không trống, không phải chuỗi mặc định, không phải chuỗi "undefined")
  if (!apiKey || 
      apiKey === 'your-imgbb-api-key-here' || 
      apiKey === '' || 
      apiKey === 'undefined' || 
      apiKey === 'null') {
    console.warn("[ImgBB] API Key chưa được cấu hình hoặc không hợp lệ. Đang lưu tạm Base64.");
    return base64Data;
  }

  try {
    // Tách phần data base64 thực tế (loại bỏ prefix data:image/...)
    const base64Image = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    const formData = new FormData();
    formData.append('image', base64Image);
    if (name) {
      formData.append('name', name);
    }

    // Sử dụng timeout để tránh treo fetch quá lâu
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ImgBB] Phản hồi lỗi từ server:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success && result.data && result.data.url) {
      console.log("[ImgBB] Tải ảnh thành công:", result.data.url);
      return result.data.url;
    } else {
      throw new Error(result.error?.message || "Lỗi định dạng phản hồi từ ImgBB");
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("[ImgBB] Lỗi: Yêu cầu quá hạn (Timeout)");
    } else {
      console.error("[ImgBB] Lỗi kết nối/tải ảnh:", error.message || error);
    }
    
    // Fallback về base64 nếu lỗi để không làm gián đoạn trải nghiệm người dùng
    // Điều này đảm bảo ứng dụng vẫn chạy được ngay cả khi ImgBB bị lỗi hoặc bị chặn
    return base64Data;
  }
};
