import React, { useState } from 'react';
import { User, UserRank, AppSettings } from '../types';
import { 
  Medal, 
  ShieldCheck, 
  Star, 
  CheckCircle2, 
  Trophy, 
  X, 
  ArrowUpCircle, 
  ArrowDownToLine,
  ChevronLeft, 
  Copy, 
  Camera, 
  UploadCloud,
  FileText,
  CircleHelp,
  Info,
  Landmark,
  Check,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { compressImage, uploadToImgBB } from '../utils';
import { BANK_BINS } from '../constants';

interface RankLimitsProps {
  user: User | null;
  isGlobalProcessing: boolean;
  onBack: () => void;
  onUpgrade: (targetRank: UserRank, bill: string) => Promise<void> | void;
  onPayOSUpgrade: (rank: string, amount: number) => Promise<void> | void;
  settings: AppSettings;
}

enum RankView {
  LIST = 'LIST',
  PAYMENT = 'PAYMENT'
}

const RankLimits: React.FC<RankLimitsProps> = ({ user, isGlobalProcessing, onBack, onUpgrade, onPayOSUpgrade, settings }) => {
  const [view, setView] = useState<RankView>(RankView.LIST);
  const [selectedRank, setSelectedRank] = useState<any>(null);
  const [billImage, setBillImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [payMethod, setPayMethod] = useState<'AUTO' | 'MANUAL'>('AUTO');

  const ranks = [
    {
      id: 'standard',
      name: 'TIÊU CHUẨN',
      code: 'TIEUCHUAN',
      min: '1.000.000 đ',
      max: '2.000.000 đ',
      limitVal: 2000000,
      icon: <Medal size={24} className="text-gray-500" />,
      features: ['Hạn mức 1 - 2 triệu', 'Duyệt trong 24h'],
    },
    {
      id: 'bronze',
      name: 'ĐỒNG',
      code: 'DONG',
      min: '1.000.000 đ',
      max: '3.000.000 đ',
      limitVal: 3000000,
      icon: <Star size={24} className="text-orange-300" />,
      features: ['Hạn mức 1 - 3 triệu', 'Ưu tiên duyệt lệnh'],
    },
    {
      id: 'silver',
      name: 'BẠC',
      code: 'BAC',
      min: '1.000.000 đ',
      max: '4.000.000 đ',
      limitVal: 4000000,
      icon: <Star size={24} className="text-blue-200" />,
      features: ['Hạn mức 1 - 4 triệu', 'Hỗ trợ 24/7'],
    },
    {
      id: 'gold',
      name: 'VÀNG',
      code: 'VANG',
      min: '1.000.000 đ',
      max: '5.000.000 đ',
      limitVal: 5000000,
      icon: <Medal size={24} className="text-yellow-400" />,
      features: ['Hạn mức 1 - 5 triệu', 'Giảm 10% phí phạt'],
    },
    {
      id: 'diamond',
      name: 'KIM CƯƠNG',
      code: 'KIMCUONG',
      min: '1.000.000 đ',
      max: '10.000.000 đ',
      limitVal: 10000000,
      icon: <ShieldCheck size={24} className="text-blue-400" />,
      features: ['Hạn mức 1 - 10 triệu', 'Duyệt lệnh tức thì'],
    }
  ];

  const currentRankIndex = ranks.findIndex(r => r.id === (user?.rank || 'standard'));

  const handleOpenPayment = (rank: any) => {
    setSelectedRank(rank);
    setView(RankView.LIST); // Need this for animation
    setTimeout(() => setView(RankView.PAYMENT), 50);
    setBillImage(null);
    setQrLoading(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  const handleDownloadQR = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QR_Nang_Hang_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading QR:', error);
      // Fallback: open in new tab if fetch fails (e.g. CORS)
      window.open(url, '_blank');
    }
  };

  const handleBillUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string, 800, 800);
        setBillImage(compressed);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (billImage && selectedRank && !isSubmitting && !isGlobalProcessing) {
      setIsSubmitting(true);
      try {
        // Tải biên lai lên ImgBB trước khi gửi yêu cầu nâng hạng
        const fileName = `HANG_${user?.id || 'unknown'}_${Date.now()}`;
        const billUrl = await uploadToImgBB(billImage, fileName);
        await onUpgrade(selectedRank.id as UserRank, billUrl);
        setView(RankView.LIST);
      } catch (e) {
        console.error("Lỗi nâng hạng:", e);
      } finally {
        setIsSubmitting(false);
      }
    } else if (!billImage) {
      alert("Vui lòng tải lên ảnh Bill thanh toán phí nâng hạng.");
    }
  };

  const hasPending = !!user?.pendingUpgradeRank;

  if (view === RankView.PAYMENT && selectedRank) {
    const fee = Math.round(selectedRank.limitVal * (settings.UPGRADE_PERCENT / 100));
    const transferContent = `${selectedRank.code} ${user?.id || 'xxxx'}`;
    
    // Find bank BIN from settings or constants
    const bankBin = settings.PAYMENT_ACCOUNT.bankBin || BANK_BINS[settings.PAYMENT_ACCOUNT.bankName.toUpperCase()] || "970422";
    const qrUrl = `https://img.vietqr.io/image/${bankBin}-${settings.PAYMENT_ACCOUNT.accountNumber}-compact2.png?amount=${fee}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(settings.PAYMENT_ACCOUNT.accountName)}`;

    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
        {copyToast && (
          <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-green-600 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-2">
              <CheckCircle2 size={16} />
              Đã sao chép thành công
            </div>
          </div>
        )}

        <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setView(RankView.LIST)}
              className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Phí nâng hạng {selectedRank.name}</h3>
              <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5 tracking-tighter">XÁC THỰC GIAO DỊCH NDV-SAFE</p>
            </div>
          </div>
          <button 
            onClick={() => setShowHelp(!showHelp)} 
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showHelp ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-400'}`}
          >
            <CircleHelp size={16} />
          </button>
        </div>

        <div className="flex-1 bg-black px-2 pt-1 pb-2 overflow-hidden flex flex-col">
          <div className="bg-[#111111] w-full rounded-2xl p-3 relative overflow-hidden shadow-2xl border border-white/10 flex-1 flex flex-col">
            <div className="flex-1 min-h-0 space-y-1.5 flex flex-col">
              {showHelp ? (
                <div className="h-full bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 animate-in fade-in zoom-in duration-300 space-y-5 overflow-y-auto">
                   <div className="flex items-center gap-3">
                      <Info size={18} className="text-[#ff8c00]" />
                      <span className="text-[14px] font-black text-[#ff8c00] uppercase tracking-widest">Hướng dẫn nâng hạng</span>
                   </div>
                   <div className="space-y-4">
                      {[
                        "Thanh toán: Lựa chọn 'Tự động' để thanh toán nhanh qua PayOS hoặc 'Thủ công' để chuyển khoản ngân hàng.",
                        "Minh chứng: Nếu chọn 'Thủ công', hãy chụp ảnh Biên lai (Bill) giao dịch rõ nét.",
                        "Xác nhận: Tải ảnh Bill lên hệ thống (đối với thủ công) để được duyệt nâng hạng nhanh nhất.",
                        "Thời gian: Hệ thống tự động sẽ nâng hạng ngay lập tức. Hệ thống thủ công xử lý trong 5-15 phút."
                      ].map((text, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">{idx + 1}</div>
                          <p className="text-[12px] font-bold text-gray-300 leading-relaxed">{text}</p>
                        </div>
                      ))}
                   </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                    {/* STEP 1: Payment Method Selection */}
                    <div className="space-y-3 shrink-0">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                          <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Phương thức thanh toán</h4>
                        </div>
                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">BƯỚC 1/2</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setPayMethod('AUTO')}
                          className={`relative overflow-hidden py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 border ${
                            payMethod === 'AUTO' 
                              ? 'bg-[#ff8c00] text-black border-[#ff8c00] shadow-lg shadow-orange-500/20' 
                              : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <ShieldCheck size={14} className={payMethod === 'AUTO' ? 'text-black' : 'text-gray-600'} />
                          Tự động (PayOS)
                          {payMethod === 'AUTO' && <div className="absolute top-0 right-0 w-5 h-5 bg-black/10 rounded-bl-full flex items-center justify-center"><Check size={8} /></div>}
                        </button>
                        <button 
                          onClick={() => setPayMethod('MANUAL')}
                          className={`relative overflow-hidden py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 border ${
                            payMethod === 'MANUAL' 
                              ? 'bg-[#ff8c00] text-black border-[#ff8c00] shadow-lg shadow-orange-500/20' 
                              : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <Landmark size={14} className={payMethod === 'MANUAL' ? 'text-black' : 'text-gray-600'} />
                          Thủ công (Bank)
                          {payMethod === 'MANUAL' && <div className="absolute top-0 right-0 w-5 h-5 bg-black/10 rounded-bl-full flex items-center justify-center"><Check size={8} /></div>}
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                      <div className="space-y-4 pb-4">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Chi tiết nâng hạng</h4>
                          </div>
                          <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">BƯỚC 2/2</span>
                        </div>

                        {payMethod === 'AUTO' ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#ff8c00]/10 rounded-full flex items-center justify-center text-[#ff8c00]">
                                  <ShieldCheck size={20} />
                                </div>
                                <div>
                                  <h3 className="text-[12px] font-black text-white uppercase tracking-wider">Nâng hạng qua PayOS</h3>
                                  <p className="text-[9px] font-bold text-[#ff8c00]/60 uppercase tracking-widest">Tự động • Nâng hạng ngay • Bảo mật</p>
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                  <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full"></div>
                                  <span>Tài khoản được nâng hạng ngay sau khi thanh toán thành công</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                  <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full"></div>
                                  <span>Không cần chờ đợi admin phê duyệt thủ công</span>
                                </div>
                              </div>

                              <div className="pt-2">
                                <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                  <span className="text-[10px] font-black text-gray-500 uppercase">Phí nâng hạng</span>
                                  <span className="text-[18px] font-black text-[#ff8c00]">{fee.toLocaleString()} đ</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Bank Info Card */}
                            <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                              <div className="bg-white/5 p-3 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Landmark size={14} className="text-[#ff8c00]" />
                                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Thông tin chuyển khoản</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></div>
                                  <span className="text-[7px] font-black text-amber-500 uppercase">Duyệt thủ công</span>
                                </div>
                              </div>
                              
                              <div className="p-4 space-y-4">
                                <div className="flex gap-4 items-center">
                                  <div className="flex flex-col items-center gap-2 shrink-0">
                                    <div className="w-32 h-32 bg-white rounded-xl p-2 shadow-inner relative overflow-hidden">
                                      <img 
                                        src={qrUrl} 
                                        alt="VietQR" 
                                        className={`w-full h-full object-contain transition-opacity duration-300 ${qrLoading ? 'opacity-0' : 'opacity-100'}`} 
                                        onLoad={() => setQrLoading(false)}
                                      />
                                      {qrLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                                          <div className="w-5 h-5 border-2 border-[#ff8c00] border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                      )}
                                    </div>
                                    <button 
                                      onClick={() => handleDownloadQR(qrUrl)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 active:bg-white/10 transition-all w-full justify-center"
                                    >
                                      <ArrowDownToLine size={12} className="text-[#ff8c00]" />
                                      <span className="text-[7px] font-black text-gray-400 uppercase">Lưu mã QR</span>
                                    </button>
                                  </div>

                                  <div className="flex-1 space-y-1.5">
                                    {[
                                      { label: 'Ngân hàng', value: settings.PAYMENT_ACCOUNT.bankName, copy: false },
                                      { label: 'Số tài khoản', value: settings.PAYMENT_ACCOUNT.accountNumber, copy: true },
                                      { label: 'Số tiền', value: `${fee.toLocaleString()} đ`, copy: true, rawValue: fee.toString() },
                                      { label: 'Nội dung', value: transferContent, copy: true, highlight: true }
                                    ].map((item, i) => (
                                      <div 
                                        key={i} 
                                        onClick={() => item.copy && copyToClipboard(item.rawValue || item.value)}
                                        className={`bg-black/40 p-2 rounded-lg border border-white/5 flex items-center justify-between group transition-all ${item.copy ? 'active:bg-black/60 cursor-pointer' : ''}`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[6px] font-bold text-gray-500 uppercase leading-none mb-1">{item.label}</p>
                                          <p className={`text-[10px] font-black leading-none truncate ${item.highlight ? 'text-[#ff8c00]' : 'text-white'}`}>{item.value}</p>
                                        </div>
                                        {item.copy && <Copy size={10} className="text-[#ff8c00] opacity-40 group-hover:opacity-100 transition-all shrink-0 ml-2" />}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Verification Part */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 px-1">
                                <Camera size={14} className="text-[#ff8c00]" />
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-white">Xác nhận giao dịch</h3>
                              </div>

                              <div 
                                onClick={() => document.getElementById('billInputRankUpgrade')?.click()}
                                className={`h-[120px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden transition-all ${billImage ? 'border-green-500 bg-green-500/5' : 'border-white/10 bg-white/5 hover:border-[#ff8c00]/30'}`}
                              >
                                <input id="billInputRankUpgrade" type="file" accept="image/*" hidden onChange={handleBillUpload} />
                                {billImage ? (
                                  <>
                                    <img src={billImage} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                                        <CheckCircle2 size={20} className="text-white" />
                                      </div>
                                      <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Biên lai đã sẵn sàng</span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {isUploading ? (
                                      <div className="animate-spin border-2 border-[#ff8c00] border-t-transparent w-8 h-8 rounded-full" />
                                    ) : (
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                                          <UploadCloud size={20} className="text-gray-400" />
                                        </div>
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tải lên biên lai giao dịch</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 p-3 bg-black flex gap-2 z-[110] border-t border-white/5 mt-auto">
          {payMethod === 'AUTO' ? (
            <button
              onClick={() => onPayOSUpgrade(selectedRank.id, selectedRank.fee)}
              disabled={isSubmitting || isGlobalProcessing}
              className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 bg-[#ff8c00] text-black shadow-orange-950/20`}
            >
              {isSubmitting || isGlobalProcessing ? 'ĐANG XỬ LÝ...' : 'NÂNG HẠNG TỰ ĐỘNG NGAY'}
            </button>
          ) : (
            <button
              disabled={!billImage || isSubmitting || isGlobalProcessing}
              onClick={handleConfirmUpgrade}
              className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 ${
                billImage && !isSubmitting && !isGlobalProcessing ? 'bg-[#ff8c00] text-black shadow-orange-950/20' : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50'
              }`}
            >
              {isSubmitting || isGlobalProcessing ? 'ĐANG XỬ LÝ...' : (billImage ? 'GỬI XÉT DUYỆT' : 'ĐÍNH KÈM BILL')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black px-4 flex flex-col animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between px-1 py-4 flex-none">
        <div className="flex items-center gap-2">
          <button 
            onClick={onBack}
            className="w-7 h-7 bg-[#111111] border border-white/5 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <X size={14} />
          </button>
          <h2 className="text-base font-black text-white tracking-tighter uppercase">Hạng & Hạn mức</h2>
        </div>
        <button 
          onClick={() => setShowHelp(!showHelp)}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showHelp ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-500'}`}
        >
          <CircleHelp size={16} />
        </button>
      </div>

      {showHelp && (
        <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 mb-3 animate-in fade-in zoom-in duration-300 space-y-4 flex-none">
           <div className="flex items-center gap-3">
              <Info size={18} className="text-[#ff8c00]" />
              <span className="text-[14px] font-black text-[#ff8c00] uppercase tracking-widest">Quy định nâng hạng</span>
           </div>
           <div className="grid grid-cols-1 gap-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">1</div>
                <p className="text-[12px] font-bold text-gray-300 leading-relaxed">Nâng hạng giúp tăng hạn mức vay tối đa, ưu tiên xét duyệt lệnh và nhận các đặc quyền riêng.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">2</div>
                <p className="text-[12px] font-bold text-gray-300 leading-relaxed">Phí nâng hạng được tính cố định là {settings.UPGRADE_PERCENT}% dựa trên hạn mức tối đa của cấp bậc mục tiêu.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">3</div>
                <p className="text-[12px] font-bold text-gray-300 leading-relaxed">Sau khi gửi yêu cầu, vui lòng đợi hệ thống kiểm tra và phê duyệt trong vòng 5-15 phút.</p>
              </div>
           </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-2 pb-4 overflow-hidden">
        {ranks.map((rank, idx) => {
          const isCurrent = user?.rank === rank.id;
          const isTargetPending = user?.pendingUpgradeRank === rank.id;
          const isHigherRank = idx > currentRankIndex;

          return (
            <div 
              key={rank.id}
              className={`flex-1 min-h-0 bg-[#111111] rounded-xl p-3 relative transition-all duration-300 border flex flex-col justify-center ${
                isCurrent ? 'border-[#ff8c00] shadow-[0_0_15px_rgba(255,140,0,0.1)]' : 'border-white/5'
              } ${!isCurrent && (currentRankIndex === ranks.length - 1 || hasPending) ? 'opacity-40' : 'opacity-100'}`}
            >
              {(isCurrent || isTargetPending) && (
                <div className={`absolute right-3 top-2 text-[6px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase ${
                  isCurrent ? 'bg-[#ff8c00] text-black' : 'bg-blue-500 text-white'
                }`}>
                  {isCurrent ? 'Hiện tại' : 'Đang duyệt'}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                  {React.cloneElement(rank.icon as React.ReactElement, { size: 16 })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-black text-white leading-tight tracking-tight uppercase">{rank.name}</h3>
                    <span className="text-[7px] font-black text-[#ff8c00] tracking-widest">{rank.max}</span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    {rank.features.slice(0, 2).map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-1">
                        <CheckCircle2 size={6} className={isCurrent ? 'text-[#ff8c00]' : 'text-gray-600'} />
                        <span className="text-[7px] font-bold text-gray-500 whitespace-nowrap">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {isHigherRank && !hasPending && (
                  <button 
                    onClick={() => handleOpenPayment(rank)}
                    className="bg-[#ff8c00] text-black font-black px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-orange-950/20 active:scale-95 transition-all text-[7px] uppercase tracking-widest"
                  >
                    <ArrowUpCircle size={10} />
                    NÂNG CẤP
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RankLimits;