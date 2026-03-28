import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { User, LoanRecord, AppSettings } from '../types';
import { Wallet, X, Eye, FileText, CheckCircle2, ShieldCheck, Eraser, ChevronLeft, CreditCard, Copy, Camera, UploadCloud, CircleHelp, Info, Award, Landmark, FileCheck, AlertCircle, AlertTriangle, ArrowDownToLine, ShieldAlert, ChevronRight, History, Calendar, Scale, Check } from 'lucide-react';
import ContractModal from './ContractModal';
import { compressImage, generateContractId, uploadToImgBB } from '../utils';
import { BANK_BINS } from '../constants';

interface LoanApplicationProps {
  user: User | null;
  loans: LoanRecord[];
  systemBudget: number;
  isGlobalProcessing: boolean;
  onApplyLoan: (amount: number, signature?: string) => Promise<void> | void;
  onSettleLoan: (loanId: string, bill: string, settlementType: 'ALL' | 'PRINCIPAL' | 'PARTIAL', bankTransactionId?: string, partialAmount?: number) => Promise<void> | void;
  onPayOSPayment: (type: 'SETTLE' | 'UPGRADE', id: string, amount: number, targetRank?: string) => Promise<void> | void;
  onBack: () => void;
  initialLoanToSettle?: LoanRecord | null;
  initialLoanToView?: LoanRecord | null;
  settings: AppSettings;
}

enum LoanStep {
  LIST = 'LIST',
  SELECT_AMOUNT = 'SELECT_AMOUNT',
  CONTRACT = 'CONTRACT',
  SETTLE_DETAIL = 'SETTLE_DETAIL'
}

const SignaturePad: React.FC<{ onSign: (signature: string | null) => void }> = ({ onSign }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d', { 
      desynchronized: true,
      willReadFrequently: false 
    });
    
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#000000';
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    initCanvas();
    const observer = new ResizeObserver(() => initCanvas());
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [initCanvas]);

  const getCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getSignatureData = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return null;
    return canvas.toDataURL('image/png');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    const coords = getCoords(e);
    isDrawing.current = true;
    lastPoint.current = coords;

    const ctx = ctxRef.current;
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
    
    if (!hasContent) {
      setHasContent(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || !ctxRef.current || !lastPoint.current) return;
    e.preventDefault();

    const ctx = ctxRef.current;
    const currentPoint = getCoords(e);
    const midPoint = {
      x: lastPoint.current.x + (currentPoint.x - lastPoint.current.x) / 2,
      y: lastPoint.current.y + (currentPoint.y - lastPoint.current.y) / 2,
    };

    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midPoint.x, midPoint.y);
    ctx.stroke();

    lastPoint.current = currentPoint;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    const ctx = ctxRef.current;
    if (ctx && lastPoint.current) {
      ctx.lineTo(lastPoint.current.x, lastPoint.current.y);
      ctx.stroke();
    }
    isDrawing.current = false;
    lastPoint.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    onSign(getSignatureData());
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onSign(null);
  };

  return (
    <div className="relative aspect-[16/9] w-full bg-[#fdfdfd] border border-dashed border-gray-200 rounded-lg overflow-hidden touch-none shadow-inner">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full h-full cursor-crosshair touch-none"
        style={{ touchAction: 'none' }}
      />
      {!hasContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
          <span className="text-[7px] font-black text-black uppercase tracking-[0.2em]">Ký tại đây</span>
          <div className="w-6 h-px bg-black mt-1"></div>
        </div>
      )}
      {hasContent && (
        <button
          onClick={clear}
          className="absolute top-1 right-1 p-1 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-all shadow-md active:scale-90"
        >
          <Eraser size={10} />
        </button>
      )}
    </div>
  );
};

const LoanApplication: React.FC<LoanApplicationProps> = ({ user, loans, systemBudget, isGlobalProcessing, onApplyLoan, onSettleLoan, onPayOSPayment, onBack, initialLoanToSettle, initialLoanToView, settings }) => {
  const [step, setStep] = useState<LoanStep>(initialLoanToSettle ? LoanStep.SETTLE_DETAIL : LoanStep.LIST);
  const [selectedAmount, setSelectedAmount] = useState<number>(1000000);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [selectedContract, setSelectedContract] = useState<LoanRecord | null>(initialLoanToView || null);
  const [settleType, setSettleType] = useState<'ALL' | 'PRINCIPAL' | 'PARTIAL'>('ALL');
  const [partialAmount, setPartialAmount] = useState<number>(1000000);
  const [settleLoan, setSettleLoan] = useState<LoanRecord | null>(initialLoanToSettle || null);
  const [billImage, setBillImage] = useState<string | null>(null);
  const [bankTransactionId, setBankTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settleLoan) {
      if ((settleLoan.extensionCount || 0) >= Number(settings.MAX_EXTENSIONS) && settleType === 'PRINCIPAL') {
        setSettleType('ALL');
      }
      if (settleLoan.amount <= 1000000 && settleType === 'PARTIAL') {
        setSettleType('ALL');
      }
    }
  }, [settleLoan, settleType, settings.MAX_EXTENSIONS]);

  useEffect(() => {
    if (initialLoanToSettle) {
      setSettleLoan(initialLoanToSettle);
      setPartialAmount(1000000);
      setStep(LoanStep.SETTLE_DETAIL);
      setQrLoading(true);
    } else if (initialLoanToView) {
      setSelectedContract(initialLoanToView);
      setStep(LoanStep.LIST);
    } else {
      setStep(LoanStep.LIST);
      setSettleLoan(null);
      setSelectedContract(null);
    }
  }, [initialLoanToSettle, initialLoanToView]);

  const [isUploading, setIsUploading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const sortedLoans = useMemo(() => {
    return [...loans].sort((a, b) => {
      const aIsInactive = ['ĐÃ TẤT TOÁN', 'BỊ TỪ CHỐI'].includes(a.status);
      const bIsInactive = ['ĐÃ TẤT TOÁN', 'BỊ TỪ CHỐI'].includes(b.status);
      if (aIsInactive !== bIsInactive) return aIsInactive ? 1 : -1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [loans]);

  const displayedLoans = showAllHistory ? sortedLoans : sortedLoans.slice(0, 5);

  const userAvailableBalance = user?.balance || 0;
  const actualMaxAllowed = Math.min(userAvailableBalance, systemBudget);
  const totalLimitCap = Number(settings.MAX_SINGLE_LOAN_AMOUNT || 10000000);

  const isSystemOutOfCapital = systemBudget < Number(settings.MIN_SYSTEM_BUDGET || 1000000);

  const nextSequence = (user?.lastLoanSeq || 0) + 1;
  const nextContractId = useMemo(() => {
    if (!user) return 'TEMP-ID';
    return generateContractId(user.id);
  }, [user?.id, step === LoanStep.CONTRACT]);

  const getCalculatedDueDate = () => {
    const now = new Date();
    const nextMonth1st = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diffTime = nextMonth1st.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let finalDate;
    if (diffDays < 10) {
      finalDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    } else {
      finalDate = nextMonth1st;
    }
    
    const dayStr = finalDate.getDate().toString().padStart(2, '0');
    const monthStr = (finalDate.getMonth() + 1).toString().padStart(2, '0');
    return `${dayStr}/${monthStr}/${finalDate.getFullYear()}`;
  };

  const dueDate = getCalculatedDueDate();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Tính tổng tiền vay trong chu kỳ hiện tại (các khoản vay được TẠO trong tháng/năm hiện tại)
  // Chỉ tính các khoản vay chưa tất toán hoàn toàn (ĐANG NỢ, CHỜ DUYỆT, ĐÃ DUYỆT, ĐANG GIẢI NGÂN, CHỜ TẤT TOÁN)
  const currentCycleTotal = loans
    .filter(l => {
      if (l.status === 'BỊ TỪ CHỐI' || l.status === 'ĐÃ TẤT TOÁN') return false;
      
      // Parse createdAt: "HH:mm:ss DD/MM/YYYY"
      const parts = l.createdAt.split(' ');
      const datePart = parts.length > 1 ? parts[1] : parts[0];
      const [d, m, y] = datePart.split('/').map(Number);
      
      return m === currentMonth && y === currentYear;
    })
    .reduce((sum, l) => sum + l.amount, 0);

  const handleConfirmSignature = async () => {
    if (signatureData && !isSubmitting && !isGlobalProcessing) {
      setIsSubmitting(true);
      try {
        // Tải chữ ký lên ImgBB trước khi gửi yêu cầu vay, thêm prefix ID để dễ quản lý
        const fileName = `CK_${user?.id || 'unknown'}_${Date.now()}`;
        const signatureUrl = await uploadToImgBB(signatureData, fileName);
        await onApplyLoan(selectedAmount, signatureUrl);
        setStep(LoanStep.LIST);
      } catch (e) {
        console.error("Lỗi đăng ký vay:", e);
      } finally {
        setIsSubmitting(false);
      }
    }
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
      link.download = `QR_Thanh_Toan_${Date.now()}.png`;
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
        try {
          const compressed = await compressImage(reader.result as string, 800, 800);
          // Tải biên lai lên ImgBB ngay sau khi nén, thêm prefix ID để dễ quản lý
          const prefix = settleType === 'ALL' ? 'TT' : 'GH';
          const fileName = `${prefix}_${user?.id || 'unknown'}_${Date.now()}`;
          const billUrl = await uploadToImgBB(compressed, fileName);
          setBillImage(billUrl);
        } catch (error) {
          console.error("Lỗi xử lý biên lai:", error);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmSettlement = async () => {
    if (settleLoan && billImage && !isSubmitting && !isGlobalProcessing) {
      setIsSubmitting(true);
      try {
        await onSettleLoan(settleLoan.id, billImage, settleType, undefined, settleType === 'PARTIAL' ? partialAmount : undefined);
        
        // Nếu là khoản vay được truyền từ Dashboard, sau khi tất toán xong thì quay về Dashboard
        if (initialLoanToSettle) {
          onBack();
        } else {
          setStep(LoanStep.LIST);
        }
        
        setSettleLoan(null);
        setBillImage(null);
        setBankTransactionId('');
      } catch (e) {
        console.error("Lỗi tất toán:", e);
      } finally {
        setIsSubmitting(false);
      }
    } else if (!billImage) {
      alert("Vui lòng tải lên ảnh Bill thanh toán");
    }
  };

  const getStatusColor = (status: string, isOverdue: boolean, settlementType?: string) => {
    if (isOverdue) return 'text-red-500';
    switch (status) {
      case 'CHỜ DUYỆT': return 'text-orange-500';
      case 'ĐÃ DUYỆT': return 'text-blue-500';
      case 'ĐANG GIẢI NGÂN': return 'text-cyan-500';
      case 'ĐANG NỢ': return 'text-orange-600';
      case 'CHỜ TẤT TOÁN': 
        if (settlementType === 'ALL') return 'text-green-500';
        if (settlementType === 'PARTIAL') return 'text-amber-500';
        return 'text-blue-500';
      case 'ĐÃ TẤT TOÁN': return 'text-green-500';
      case 'BỊ TỪ CHỐI': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const renderList = () => {
    // Logic giới hạn 10tr chu kỳ:
    // Khoản vay trước đó phải được xử lý xong (không ở trạng thái chờ)
    // Các trạng thái chặn vay mới: CHỜ DUYỆT, ĐÃ DUYỆT, ĐANG GIẢI NGÂN, CHỜ TẤT TOÁN
    const isPreviousLoanPending = loans.some(l => ['CHỜ DUYỆT', 'ĐÃ DUYỆT', 'ĐANG GIẢI NGÂN', 'CHỜ TẤT TOÁN'].includes(l.status));

    const today = new Date();
    
    const isLimitReached = currentCycleTotal >= Number(settings.MAX_LOAN_PER_CYCLE || 10000000);

    const hasOverdue = loans.some(l => {
      if (l.status !== 'ĐANG NỢ' && l.status !== 'CHỜ TẤT TOÁN') return false;
      const [d, m, y] = l.date.split('/').map(Number);
      const dueDateObj = new Date(y, m - 1, d);
      return dueDateObj < today;
    });

    const isApplyDisabled = hasOverdue || isSystemOutOfCapital || isPreviousLoanPending || isLimitReached || (user?.balance || 0) <= 0;

    return (
      <div className="w-full space-y-4 animate-in fade-in duration-500">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white tracking-tighter uppercase">Vay</h2>
            <button 
              onClick={() => setShowHelp(!showHelp)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all animate-bounce-subtle ${showHelp ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-500'}`}
            >
              <CircleHelp size={16} />
            </button>
          </div>
            <button 
            disabled={isApplyDisabled}
            onClick={() => {
              const maxPossible = Math.min(10000000 - currentCycleTotal, actualMaxAllowed);
              setSelectedAmount(Math.min(1000000, maxPossible));
              setStep(LoanStep.SELECT_AMOUNT);
            }}
            className={`font-black px-4 py-1.5 rounded-full text-[8px] tracking-widest transition-all shadow-lg ${
              isApplyDisabled 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50' 
                : 'bg-[#ff8c00] text-black active:scale-95 shadow-orange-950/20'
            }`}
          >
            {hasOverdue 
              ? 'NỢ XẤU - KHÓA' 
              : isLimitReached
                ? 'ĐẠT GIỚI HẠN 10TR/THÁNG'
                : isPreviousLoanPending 
                  ? 'CHỜ DUYỆT KHOẢN TRƯỚC' 
                  : isSystemOutOfCapital 
                    ? 'BẢO TRÌ VỐN' 
                    : 'ĐĂNG KÝ MỚI'}
          </button>
        </div>

        {showHelp && (
          <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 animate-in fade-in zoom-in duration-300 space-y-5">
             <div className="flex items-center gap-3">
                <Info size={18} className="text-[#ff8c00]" />
                <span className="text-[14px] font-black text-[#ff8c00] uppercase tracking-widest">Chính sách vay vốn</span>
             </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">1</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Lãi suất:</span> Ưu đãi 0% cho tất cả các khoản vay trong kỳ hạn quy định.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">2</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Hạn mức:</span> Tổng dư nợ tối đa không vượt quá 10.000.000 VNĐ trong chu kỳ 30 ngày.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">3</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Vay bổ sung:</span> Bạn có thể đăng ký vay nhiều lần nếu tổng dư nợ chưa đạt giới hạn tối đa.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">4</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Quy trình:</span> Hệ thống chỉ xử lý duy nhất 01 yêu cầu vay tại một thời điểm để đảm bảo an toàn.
                  </p>
                </div>
              </div>
          </div>
        )}

        <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Wallet className="text-[#ff8c00]" size={20} />
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Hạn mức khả dụng</p>
                <p className="text-lg font-black text-white">{(userAvailableBalance).toLocaleString()} đ</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {isPreviousLoanPending && !hasOverdue && (
                <div className="flex items-center gap-1 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 animate-pulse">
                  <Info size={10} className="text-blue-500" />
                  <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Đang xét duyệt</span>
                </div>
              )}
              {isSystemOutOfCapital && !hasOverdue && !isPreviousLoanPending && (
                <div className="flex items-center gap-1 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 animate-pulse">
                  <ShieldAlert size={10} className="text-orange-500" />
                  <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest">Bảo trì vốn</span>
                </div>
              )}
            </div>
          </div>
          
          {isLimitReached && !hasOverdue && (
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest text-center px-1">
              Đã đạt giới hạn vay 10.000.000 đ trong chu kỳ này
            </p>
          )}

          {!isLimitReached && (isPreviousLoanPending || isSystemOutOfCapital) && !hasOverdue && (
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest text-center px-1">
              {isPreviousLoanPending 
                  ? 'Đợi duyệt khoản vay trước' 
                  : 'Hệ thống đang bảo trì vốn'}
            </p>
          )}

          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#ff8c00] transition-all duration-1000" 
              style={{ width: `${(userAvailableBalance / totalLimitCap) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Loan History List in Apply Tab */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1 text-gray-400">
            <div className="flex items-center gap-2">
              <History size={14} />
              <h3 className="text-[9px] font-black uppercase tracking-widest">Lịch sử giao dịch</h3>
            </div>
            {loans.length > 5 && (
              <button 
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-[8px] font-black text-[#ff8c00] uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
              >
                {showAllHistory ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={12} className={showAllHistory ? 'rotate-90' : ''} />
              </button>
            )}
          </div>

          <div className="space-y-2 pb-10">
            {loans.length === 0 ? (
              <div className="bg-[#111111]/50 border border-white/5 border-dashed rounded-2xl p-8 text-center">
                <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Chưa có giao dịch nào</p>
              </div>
            ) : (
              displayedLoans.map((item, idx) => {
                const [d, m, y] = item.date.split('/').map(Number);
                const isOverdue = (item.status === 'ĐANG NỢ' || item.status === 'CHỜ TẤT TOÁN') && new Date(y, m - 1, d) < today;
                const statusColor = getStatusColor(item.status, isOverdue, item.settlementType);

                return (
                  <div key={idx} className={`bg-[#111111] border rounded-2xl p-3.5 flex flex-col gap-2.5 ${isOverdue ? 'border-red-600/30 bg-red-600/5' : 'border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-sm font-black text-white leading-none">{item.amount.toLocaleString()} đ</p>
                            <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">#{item.id}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`w-1 h-1 rounded-full ${
                              item.status === 'ĐÃ TẤT TOÁN' ? 'bg-green-500' : 
                              isOverdue ? 'bg-red-500 animate-pulse' : 
                              item.status === 'CHỜ TẤT TOÁN' ? (
                                item.settlementType === 'ALL' ? 'bg-green-500 animate-pulse' : 
                                (item.settlementType === 'PARTIAL' ? 'bg-amber-500 animate-pulse' : 'bg-blue-500 animate-pulse')
                              ) : 'bg-orange-500 animate-pulse'
                            }`}></div>
                            <span className={`text-[7px] font-black uppercase flex items-center ${statusColor}`}>
                              {isOverdue ? 'QUÁ HẠN' : item.status}
                              {item.status === 'CHỜ TẤT TOÁN' && (
                                <span className={`px-1 rounded text-[6px] ml-1 ${
                                  item.settlementType === 'ALL' ? 'bg-green-500 text-white' : 
                                  (item.settlementType === 'PARTIAL' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white')
                                }`}>
                                  {item.settlementType === 'PRINCIPAL' ? 'GH' : (item.settlementType === 'PARTIAL' ? 'TTMP' : 'TT')}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                         <button 
                           onClick={() => setSelectedContract(item)}
                           className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-all"
                         >
                           <Eye size={14} />
                         </button>
                         {(item.status === 'ĐANG NỢ' || item.status === 'ĐANG GIẢI NGÂN') && (
                           <button 
                             onClick={() => {
                               setSettleLoan(item);
                               setPartialAmount(1000000);
                               setStep(LoanStep.SETTLE_DETAIL);
                               setQrLoading(true);
                             }}
                             className="bg-white text-black font-black px-2.5 py-1.5 rounded-lg text-[7px] uppercase tracking-widest active:scale-95 transition-all"
                           >
                             Tất toán
                           </button>
                         )}
                      </div>
                    </div>
                    
                    <div className="mt-1">
                      {item.rejectionReason && (
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden mb-0.5">
                          <AlertTriangle size={8} className="text-red-500 shrink-0" />
                          <p className="text-[7px] font-black text-red-500 uppercase tracking-widest truncate">
                            Lý do từ chối: {item.rejectionReason}
                          </p>
                        </div>
                      )}

                      <div className="border-t border-white/5 pt-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2.5">
                            <p className="text-[7px] font-bold text-gray-700">Hạn: {item.date}</p>
                            <p className="text-[7px] font-bold text-gray-700">Tạo: {item.createdAt}</p>
                          </div>
                          {isOverdue && (
                            <div className="text-right">
                              <p className="text-[6px] font-black text-gray-600 uppercase tracking-widest leading-none">Phí phạt trễ hạn</p>
                              <p className="text-[9px] font-black text-red-500">{(item.fine || 0).toLocaleString()} đ</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedContract && (
          <ContractModal 
            contract={selectedContract} 
            user={user} 
            onClose={() => {
              setSelectedContract(null);
              if (initialLoanToView) onBack();
            }} 
            settings={settings}
          />
        )}
      </div>
    );
  };

  const renderSelectAmount = () => {
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      if (val <= actualMaxAllowed) {
        setSelectedAmount(val);
      }
    };

    const isLimitedByBudget = systemBudget < userAvailableBalance;

    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
        <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-[#ff8c00]">
              <Award size={16} />
            </div>
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Đăng ký khoản vay</h3>
              <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5 tracking-tighter">XÁC THỰC ĐIỆN TỬ NDV-SAFE</p>
            </div>
          </div>
          <button 
            onClick={() => setStep(LoanStep.LIST)}
            className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 bg-black px-2 pt-1 pb-2 overflow-hidden flex flex-col">
          <div className="bg-[#111111] w-full rounded-2xl p-4 relative overflow-hidden shadow-2xl border border-white/10 flex-1 flex flex-col justify-center space-y-8">
            <div className="space-y-2 text-center">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Chọn số tiền vay</h3>
              <p className="text-4xl font-black text-[#ff8c00] tracking-tighter">
                {selectedAmount.toLocaleString()} <span className="text-lg">đ</span>
              </p>
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Lãi suất 0% (Ưu đãi thành viên)</p>
            </div>

            {isLimitedByBudget && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in zoom-in duration-300 flex flex-col items-center text-center">
                 <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle size={14} className="text-red-500" />
                    <span className="text-[9px] font-black text-red-500 uppercase">Nguồn vốn giới hạn</span>
                 </div>
                 <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                   Tối đa {systemBudget.toLocaleString()} đ. Hạn mức sẽ mở lại sau khi nạp vốn.
                 </p>
              </div>
            )}

            <div className="space-y-8 px-2">
              <div className="relative pt-4 pb-1">
                <input
                  type="range"
                  min="1000000"
                  max={Math.min(10000000 - currentCycleTotal, actualMaxAllowed)}
                  step="1000000"
                  value={selectedAmount}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-[#ff8c00] focus:outline-none"
                />
                <div className="flex justify-between mt-6">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tối thiểu</span>
                    <span className="text-[11px] font-black text-white">1.000.000 đ</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isLimitedByBudget ? 'text-red-500' : 'text-orange-500/50'}`}>
                      {isLimitedByBudget ? 'Ngân sách hệ thống' : 'Hạn mức khả dụng'}
                    </span>
                    <span className={`text-[11px] font-black ${isLimitedByBudget ? 'text-red-500' : 'text-[#ff8c00]'}`}>
                      {Math.min(10000000 - currentCycleTotal, actualMaxAllowed).toLocaleString()} đ
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 p-3 bg-black flex gap-2 z-[110] border-t border-white/5 mt-auto">
          <button
            disabled={actualMaxAllowed < 1000000}
            onClick={() => { setStep(LoanStep.CONTRACT); setSignatureData(null); }}
            className={`w-full font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all ${
              actualMaxAllowed < 1000000 ? 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50' : 'bg-[#ff8c00] text-black shadow-orange-950/20'
            }`}
          >
            {actualMaxAllowed < 1000000 ? 'KHÔNG ĐỦ NGÂN SÁCH' : 'TIẾP TỤC ĐẾN HỢP ĐỒNG'}
          </button>
        </div>
      </div>
    );
  };

  const renderSettleDetail = () => {
    if (!settleLoan) return null;
    
    const amountAll = Math.round(settleLoan.amount + (settleLoan.fine || 0));
    const amountPrincipal = Math.round((settleLoan.amount * (settings.PRE_DISBURSEMENT_FEE / 100)) + (settleLoan.fine || 0));
    const amountPartial = Math.round(partialAmount + ((settleLoan.amount - partialAmount) * (settings.PRE_DISBURSEMENT_FEE / 100)) + (settleLoan.fine || 0));
    
    // Logic giới hạn gia hạn
    const extensionCount = settleLoan.extensionCount || 0;
    const canSettlePrincipal = extensionCount < settings.MAX_EXTENSIONS;
    const isLastExtension = extensionCount === (settings.MAX_EXTENSIONS - 1);
    const isLimitReached = extensionCount >= settings.MAX_EXTENSIONS;

    const currentAmount = settleType === 'ALL' ? amountAll : (settleType === 'PRINCIPAL' ? amountPrincipal : amountPartial);
    const currentPrefix = settleType === 'ALL' ? 'TT' : (settleType === 'PRINCIPAL' ? 'GH' : 'TTMP');
    const content = `${currentPrefix}-${settleLoan.id}`;
    
    // Find bank BIN from settings or constants
    const bankBin = settings.PAYMENT_ACCOUNT.bankBin || BANK_BINS[settings.PAYMENT_ACCOUNT.bankName.toUpperCase()] || "970422";
    const qrUrl = `https://img.vietqr.io/image/${bankBin}-${settings.PAYMENT_ACCOUNT.accountNumber}-compact2.png?amount=${currentAmount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(settings.PAYMENT_ACCOUNT.accountName)}`;

    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
        <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (initialLoanToSettle) {
                  onBack();
                } else {
                  setStep(LoanStep.LIST);
                }
              }} 
              className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Tất toán khoản vay</h3>
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
            <div className="flex-none mb-3">
              {isLimitReached && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 mb-2 flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-300">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <p className="text-[7px] font-black text-red-500 uppercase tracking-widest text-center">
                    Bạn đã hết lượt gia hạn ({extensionCount}/{settings.MAX_EXTENSIONS}). Vui lòng Tất toán toàn bộ hoặc TTMP.
                  </p>
                </div>
              )}
              {settleType === 'PRINCIPAL' && isLastExtension && !isLimitReached && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 mb-2 flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-300">
                  <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                  <p className="text-[7px] font-black text-amber-500 uppercase tracking-widest text-center">
                    Cảnh báo: Đây là lần gia hạn cuối cùng của bạn.
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col space-y-4">
              {showHelp ? (
                <div className="h-full bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 animate-in fade-in zoom-in duration-300 space-y-5 overflow-y-auto">
                   <div className="flex items-center gap-3">
                      <Info size={18} className="text-[#ff8c00]" />
                      <span className="text-[14px] font-black text-[#ff8c00] uppercase tracking-widest">Hướng dẫn tất toán</span>
                   </div>
                   <div className="space-y-4">
                      {[
                        "Bước 1: Chọn hình thức thanh toán (Tự động hoặc Thủ công).",
                        "Bước 2: Chọn loại tất toán (Toàn bộ, Một phần hoặc Gia hạn).",
                        "Thanh toán: Lựa chọn 'Tự động' để thanh toán nhanh qua PayOS hoặc 'Thủ công' để chuyển khoản ngân hàng.",
                        "Minh chứng: Nếu chọn 'Thủ công', hãy chụp ảnh Biên lai (Bill) giao dịch rõ nét.",
                        "Xác nhận: Nhấn nút xác nhận ở cuối trang để hoàn tất giao dịch."
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
                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">BƯỚC 1/3</span>
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

                    {/* STEP 2: Settlement Type Selection */}
                    <div className="space-y-3 shrink-0">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                          <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Hình thức tất toán</h4>
                        </div>
                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">BƯỚC 2/3</span>
                      </div>
                      <div className="flex bg-black/60 p-1 rounded-2xl border border-white/5 gap-1">
                        {[
                          { id: 'ALL', label: 'Tất toán', icon: <Scale size={12} /> },
                          { id: 'PARTIAL', label: 'TTMP', icon: <Award size={12} /> },
                          { id: 'PRINCIPAL', label: `Gia hạn`, icon: <ShieldCheck size={12} />, sub: `(${extensionCount}/${settings.MAX_EXTENSIONS})` }
                        ].map((type) => {
                          const isDisabled = type.id === 'PRINCIPAL' && !canSettlePrincipal;
                          const isActive = settleType === type.id;
                          return (
                            <button
                              key={type.id}
                              disabled={isDisabled}
                              onClick={() => {
                                setSettleType(type.id as any);
                                setQrLoading(true);
                              }}
                              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all border ${
                                isActive 
                                  ? 'bg-white/10 text-[#ff8c00] font-black border-[#ff8c00]/40 shadow-inner' 
                                  : isDisabled ? 'opacity-20 cursor-not-allowed border-transparent' : 'text-gray-500 hover:text-white border-transparent'
                              }`}
                            >
                              {type.icon}
                              <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">{type.label}</span>
                              {type.sub && <span className="text-[5px] font-bold opacity-60">{type.sub}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* STEP 3: Payment Details */}
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                      <div className="space-y-4 pb-4">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Chi tiết thanh toán</h4>
                          </div>
                          <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">BƯỚC 3/3</span>
                        </div>

                        {payMethod === 'AUTO' ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#ff8c00]/10 rounded-full flex items-center justify-center text-[#ff8c00]">
                                  <ShieldCheck size={20} />
                                </div>
                                <div>
                                  <h3 className="text-[12px] font-black text-white uppercase tracking-wider">Cổng thanh toán PayOS</h3>
                                  <p className="text-[9px] font-bold text-[#ff8c00]/60 uppercase tracking-widest">Duyệt tự động • An toàn • 24/7</p>
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                  <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full"></div>
                                  <span>Hệ thống tự động cập nhật ngay sau khi thanh toán</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                  <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full"></div>
                                  <span>Hỗ trợ thanh toán qua mã QR của mọi ngân hàng</span>
                                </div>
                              </div>

                              {settleType === 'PARTIAL' && (
                                <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Số tiền gốc trả</span>
                                    <span className="text-[12px] font-black text-[#ff8c00]">{partialAmount.toLocaleString()} đ</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="1000000"
                                    max={Math.max(1000000, Math.min(9000000, settleLoan.amount - 1000000))}
                                    step="1000000"
                                    value={partialAmount}
                                    onChange={(e) => {
                                      setPartialAmount(parseInt(e.target.value));
                                    }}
                                    className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-[#ff8c00] focus:outline-none"
                                  />
                                </div>
                              )}

                              <div className="pt-2">
                                <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                  <span className="text-[10px] font-black text-gray-500 uppercase">Số tiền cần trả</span>
                                  <span className="text-[18px] font-black text-[#ff8c00]">{currentAmount.toLocaleString()} đ</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Partial Amount Slider */}
                            {settleType === 'PARTIAL' && (
                              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Số tiền gốc trả</span>
                                  <span className="text-[12px] font-black text-[#ff8c00]">{partialAmount.toLocaleString()} đ</span>
                                </div>
                                <input
                                  type="range"
                                  min="1000000"
                                  max={Math.max(1000000, Math.min(9000000, settleLoan.amount - 1000000))}
                                  step="1000000"
                                  value={partialAmount}
                                  onChange={(e) => {
                                    setPartialAmount(parseInt(e.target.value));
                                    setQrLoading(true);
                                  }}
                                  className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-[#ff8c00] focus:outline-none"
                                />
                                <p className="text-[8px] font-bold text-gray-500 italic text-center">Kéo để điều chỉnh số tiền muốn trả trước</p>
                              </div>
                            )}

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
                                        onError={() => setQrLoading(false)}
                                      />
                                      {qrLoading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                                          <div className="w-5 h-5 border-2 border-[#ff8c00] border-t-transparent rounded-full animate-spin mb-2"></div>
                                          <span className="text-[6px] font-black text-[#ff8c00] uppercase animate-pulse">Đang tải mã QR...</span>
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
                                      { label: 'Số tiền', value: `${currentAmount.toLocaleString()} đ`, copy: true, rawValue: currentAmount.toString() },
                                      { label: 'Nội dung', value: content, copy: true, highlight: true }
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
                                onClick={() => document.getElementById('billInputSettle')?.click()}
                                className={`h-[120px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden transition-all ${billImage ? 'border-green-500 bg-green-500/5' : 'border-white/10 bg-white/5 hover:border-[#ff8c00]/30'}`}
                              >
                                <input id="billInputSettle" type="file" accept="image/*" hidden onChange={handleBillUpload} />
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
              onClick={() => onPayOSPayment('SETTLE', settleLoan.id, currentAmount, undefined, settleType, settleType === 'PARTIAL' ? partialAmount : undefined)}
              disabled={isSubmitting || isGlobalProcessing}
              className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 bg-[#ff8c00] text-black shadow-orange-950/20`}
            >
              {isSubmitting || isGlobalProcessing ? 'ĐANG XỬ LÝ...' : 'THANH TOÁN PAYOS NGAY'}
            </button>
          ) : (
            <button
              disabled={!billImage || isSubmitting || isGlobalProcessing || qrLoading}
              onClick={handleConfirmSettlement}
              className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 ${
                billImage && !isSubmitting && !isGlobalProcessing && !qrLoading ? 'bg-[#ff8c00] text-black shadow-orange-950/20' : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50'
              }`}
            >
              {isSubmitting || isGlobalProcessing ? 'ĐANG XỬ LÝ...' : (qrLoading ? 'ĐANG TẢI MÃ QR...' : (billImage ? 'GỬI XÉT DUYỆT' : 'ĐÍNH KÈM BILL'))}
            </button>
          )}
        </div>
      </div>
    );
  };
  const renderContract = () => (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
      <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-[#ff8c00]">
            <Award size={16} />
          </div>
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Phác thảo hợp đồng</h3>
            <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5 tracking-tighter">XÁC THỰC ĐIỆN TỬ NDV-SAFE</p>
          </div>
        </div>
        <button 
          onClick={() => setStep(LoanStep.SELECT_AMOUNT)}
          className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 bg-black px-2 pt-1 pb-2 overflow-hidden flex flex-col">
        <div className="bg-white w-full rounded-2xl p-2.5 relative overflow-hidden shadow-2xl border border-gray-100 flex-1 flex flex-col">
          
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-[0.01] rotate-[-35deg] select-none space-y-8">
            <span className="text-3xl font-black whitespace-nowrap">NDV ORIGINAL DOCUMENT</span>
            <span className="text-3xl font-black whitespace-nowrap">AUTHENTIC SIGNING</span>
          </div>

          <div className="flex flex-col items-center space-y-1 relative z-10 flex-none">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-[#ff8c00] font-black text-xs shadow-lg border border-orange-500/20">
                NDV
               </div>
               <div className="h-4 w-px bg-gray-200"></div>
               <Landmark size={16} className="text-gray-300" />
            </div>
            <div className="text-center">
              <h2 className="text-sm font-black text-black tracking-tighter uppercase leading-tight">Hợp đồng vay tiêu dùng</h2>
              <p className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Mã số: {nextContractId}</p>
            </div>
          </div>

          <div className="w-full h-px bg-gray-100 my-2 relative z-10 flex-none"></div>

          <div className="flex-1 min-h-0 flex flex-col justify-between relative z-10 overflow-hidden py-0.5">
            
            {/* Điều 1: Các bên */}
            <section className="space-y-1 flex-none">
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-black rounded flex items-center justify-center text-white font-black text-[6px]">01</div>
                <h4 className="text-[9px] font-black text-black uppercase tracking-widest">Các bên giao kết</h4>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex flex-col justify-center shadow-sm">
                  <p className="text-gray-400 uppercase text-[5px] font-black tracking-widest mb-0.5">Bên A (Cho vay)</p>
                  <p className="text-[8px] text-black font-black uppercase truncate">NDV FINANCIAL</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex flex-col justify-center shadow-sm">
                  <p className="text-gray-400 uppercase text-[5px] font-black tracking-widest mb-0.5">Bên B (Người vay)</p>
                  <p className="text-[8px] text-black font-black uppercase truncate">{user?.fullName || 'KHÁCH HÀNG'}</p>
                </div>
              </div>
            </section>

            {/* Điều 2: Chi tiết khoản vay */}
            <section className="space-y-1 flex-none">
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-black rounded flex items-center justify-center text-white font-black text-[6px]">02</div>
                <h4 className="text-[9px] font-black text-black uppercase tracking-widest">Chi tiết khoản vay</h4>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex items-center justify-center shadow-sm">
                <div className="flex flex-col items-center">
                  <span className="text-[6px] font-black text-gray-400 uppercase tracking-wider">Số tiền vay gốc</span>
                  <span className="text-[12px] font-black text-black">{selectedAmount.toLocaleString()} đ</span>
                </div>
              </div>
            </section>

            {/* Điều 3: Thời hạn & Lãi suất */}
            <section className="space-y-1 flex-none">
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-black rounded flex items-center justify-center text-white font-black text-[6px]">03</div>
                <h4 className="text-[9px] font-black text-black uppercase tracking-widest">Thời hạn & Lãi suất</h4>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-1.5">
                  <Calendar size={10} className="text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-[6px] font-black text-gray-400 uppercase tracking-wider">Ngày đến hạn</span>
                    <span className="text-[9px] font-black text-black">{dueDate}</span>
                  </div>
                </div>
                <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">Lãi suất: 0%</div>
              </div>
            </section>

            {/* Điều 4: ĐIỀU KHOẢN - NGHĨA VỤ - PHÍ PHẠT */}
            <section className="space-y-1 flex-none">
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-red-600 rounded flex items-center justify-center text-white font-black text-[7px]">04</div>
                <h4 className="text-[9px] font-black text-red-600 uppercase tracking-widest">ĐIỀU KHOẢN - NGHĨA VỤ - PHÍ PHẠT</h4>
              </div>
              <div className="bg-red-50/50 border border-red-100 rounded-lg p-2 shadow-sm flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-[7px] font-bold text-gray-700 leading-tight">
                    • Thanh toán đúng hạn quy định.<br />
                    • Phí quá hạn <span className="text-red-600 font-black">{settings.FINE_RATE}%/ngày</span>.
                  </p>
                </div>
                <div className="w-px h-6 bg-red-200"></div>
                <div className="flex-1">
                  <p className="text-[7px] font-bold text-gray-700 leading-tight">
                    • Gia hạn tối đa {settings.MAX_EXTENSIONS.toString().padStart(2, '0')} lần.<br />
                    • Ký số có giá trị pháp lý.
                  </p>
                </div>
              </div>
            </section>

            {/* Chữ ký */}
            <section className="flex-none pt-1 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center justify-center space-y-0.5">
                  <p className="text-[5px] font-black text-gray-400 uppercase tracking-widest">Đại diện Bên A</p>
                  <div className="w-full aspect-[16/9] bg-gray-50 border border-gray-100 rounded-md flex items-center justify-center overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-80 scale-150 -rotate-12">
                      <div className="w-12 h-12 rounded-full border-2 border-red-600 border-dashed flex flex-col items-center justify-center text-red-600">
                        <span className="text-[3px] font-black uppercase leading-none">NDV GROUP</span>
                        <ShieldCheck size={10} className="my-0.5" />
                        <span className="text-[2.5px] font-black uppercase leading-none">VERIFIED</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[6px] font-black text-red-600 uppercase tracking-tighter">ĐÃ KÝ SỐ</p>
                </div>

                <div className="flex flex-col items-center space-y-0.5">
                  <p className="text-[5px] font-black text-gray-400 uppercase tracking-widest">Người vay Bên B</p>
                  <div className="w-full aspect-[16/9] bg-gray-50 border border-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                    <SignaturePad onSign={setSignatureData} />
                  </div>
                  <p className="text-[5px] font-black text-blue-600 uppercase tracking-tighter truncate w-full text-center">{user?.fullName}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="flex justify-center pt-2 mt-1 border-t border-gray-50 flex-none">
             <p className="text-[5px] font-bold text-gray-300 uppercase tracking-[0.2em]">Hợp đồng số hóa NDV Financial System v1.26</p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-3 bg-black flex gap-2 z-[110] border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] mt-auto">
        <button 
          onClick={() => setStep(LoanStep.SELECT_AMOUNT)}
          className="flex-1 py-3.5 rounded-xl border border-white/10 text-white font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Hủy bỏ
        </button>
        <button 
          onClick={handleConfirmSignature}
          disabled={!signatureData || isSubmitting || isGlobalProcessing}
          className={`flex-[1.5] py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl ${
            signatureData && !isSubmitting && !isGlobalProcessing ? 'bg-[#ff8c00] text-black shadow-orange-950/20' : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50'
          }`}
        >
          {isSubmitting || isGlobalProcessing ? 'ĐANG GỬI...' : (signatureData ? 'Ký & Gửi hồ sơ' : 'Vui lòng ký tên')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-black px-5 pt-4 overflow-x-hidden relative">
      {copyToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-2">
            <CheckCircle2 size={16} />
            Đã sao chép thành công
          </div>
        </div>
      )}

      {step === LoanStep.LIST && renderList()}
      {step === LoanStep.SELECT_AMOUNT && (<>{renderList()}{renderSelectAmount()}</>)}
      {step === LoanStep.CONTRACT && renderContract()}
      {step === LoanStep.SETTLE_DETAIL && renderSettleDetail()}
    </div>
  );
};

export default LoanApplication;