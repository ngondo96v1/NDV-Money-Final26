
import React, { useState, useRef, useEffect } from 'react';
import { Database, Settings, AlertCircle, RefreshCw, X, Check, Download, Upload, Loader2, Search } from 'lucide-react';
import BankSearchableSelect from './BankSearchableSelect';

interface AdminSystemProps {
  onReset: () => void;
  onImportSuccess: () => void;
  onBack: () => void;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  settings: any;
  onSettingsUpdate: (newSettings: any) => void;
}

const AdminSystem: React.FC<AdminSystemProps> = ({ onReset, onImportSuccess, onBack, authenticatedFetch, settings, onSettingsUpdate }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isCheckingBank, setIsCheckingBank] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const formatNumberWithDots = (val: string | number) => {
    if (val === undefined || val === null || val === '') return '';
    const num = val.toString().replace(/\D/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberFromDots = (val: string) => {
    return val.replace(/\./g, '');
  };

  const defaultSettings = {
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    IMGBB_API_KEY: '',
    PAYMENT_ACCOUNT: { bankName: '', bankBin: '', accountNumber: '', accountName: '' },
    PRE_DISBURSEMENT_FEE: '',
    MAX_EXTENSIONS: '',
    UPGRADE_PERCENT: '',
    FINE_RATE: '',
    MAX_FINE_PERCENT: '30',
    MAX_LOAN_PER_CYCLE: '10000000',
    MIN_SYSTEM_BUDGET: '1000000',
    MAX_SINGLE_LOAN_AMOUNT: '10000000'
  };

  const [localSettings, setLocalSettings] = useState<any>(() => {
    if (!settings) return defaultSettings;
    return {
      ...defaultSettings,
      ...settings,
      PAYMENT_ACCOUNT: {
        ...defaultSettings.PAYMENT_ACCOUNT,
        ...(settings.PAYMENT_ACCOUNT || {})
      }
    };
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        ...defaultSettings,
        ...settings,
        PAYMENT_ACCOUNT: {
          ...defaultSettings.PAYMENT_ACCOUNT,
          ...(settings.PAYMENT_ACCOUNT || {})
        }
      });
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsMessage(null);
    try {
      // Only send changed values
      const changedSettings: any = {};
      
      if (localSettings.SUPABASE_URL !== settings?.SUPABASE_URL) 
        changedSettings.SUPABASE_URL = localSettings.SUPABASE_URL;
      
      if (localSettings.SUPABASE_SERVICE_ROLE_KEY !== settings?.SUPABASE_SERVICE_ROLE_KEY) 
        changedSettings.SUPABASE_SERVICE_ROLE_KEY = localSettings.SUPABASE_SERVICE_ROLE_KEY;
      
      if (localSettings.IMGBB_API_KEY !== settings?.IMGBB_API_KEY) 
        changedSettings.IMGBB_API_KEY = localSettings.IMGBB_API_KEY;
      
      if (JSON.stringify(localSettings.PAYMENT_ACCOUNT) !== JSON.stringify(settings?.PAYMENT_ACCOUNT))
        changedSettings.PAYMENT_ACCOUNT = localSettings.PAYMENT_ACCOUNT;
      
      if (localSettings.PRE_DISBURSEMENT_FEE !== settings?.PRE_DISBURSEMENT_FEE)
        changedSettings.PRE_DISBURSEMENT_FEE = localSettings.PRE_DISBURSEMENT_FEE;
      
      if (localSettings.MAX_EXTENSIONS !== settings?.MAX_EXTENSIONS)
        changedSettings.MAX_EXTENSIONS = localSettings.MAX_EXTENSIONS;
      
      if (localSettings.UPGRADE_PERCENT !== settings?.UPGRADE_PERCENT)
        changedSettings.UPGRADE_PERCENT = localSettings.UPGRADE_PERCENT;
      
      if (localSettings.FINE_RATE !== settings?.FINE_RATE)
        changedSettings.FINE_RATE = localSettings.FINE_RATE;

      if (localSettings.MAX_FINE_PERCENT !== settings?.MAX_FINE_PERCENT)
        changedSettings.MAX_FINE_PERCENT = localSettings.MAX_FINE_PERCENT;

      if (localSettings.MAX_LOAN_PER_CYCLE !== settings?.MAX_LOAN_PER_CYCLE)
        changedSettings.MAX_LOAN_PER_CYCLE = localSettings.MAX_LOAN_PER_CYCLE;
      
      if (localSettings.MIN_SYSTEM_BUDGET !== settings?.MIN_SYSTEM_BUDGET)
        changedSettings.MIN_SYSTEM_BUDGET = localSettings.MIN_SYSTEM_BUDGET;

      if (localSettings.MAX_SINGLE_LOAN_AMOUNT !== settings?.MAX_SINGLE_LOAN_AMOUNT)
        changedSettings.MAX_SINGLE_LOAN_AMOUNT = localSettings.MAX_SINGLE_LOAN_AMOUNT;

      if (Object.keys(changedSettings).length === 0) {
        setSettingsMessage({ type: 'error', text: 'Không có thay đổi nào để lưu' });
        setIsSavingSettings(false);
        return;
      }

      const response = await authenticatedFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(changedSettings)
      });
      const result = await response.json();
      if (response.ok) {
        setSettingsMessage({ type: 'success', text: result.message });
        if (result.settings) {
          onSettingsUpdate(result.settings);
        } else {
          onSettingsUpdate({ ...settings, ...changedSettings });
        }
      } else {
        setSettingsMessage({ type: 'error', text: result.error || 'Lỗi khi lưu cài đặt' });
      }
    } catch (e) {
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối khi lưu cài đặt' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCheckBankAccount = async () => {
    if (!localSettings.PAYMENT_ACCOUNT.bankName || !localSettings.PAYMENT_ACCOUNT.accountNumber) {
      alert("Vui lòng nhập Ngân hàng và Số tài khoản");
      return;
    }

    setIsCheckingBank(true);
    try {
      // Find bank BIN (Bank Identification Number)
      // This is a simplified list, in a real app you'd fetch this from VietQR
      const banks = [
        { name: "MB Bank", bin: "970422" },
        { name: "Vietcombank", bin: "970436" },
        { name: "Techcombank", bin: "970407" },
        { name: "VietinBank", bin: "970415" },
        { name: "BIDV", bin: "970418" },
        { name: "Agribank", bin: "970405" },
        { name: "VPBank", bin: "970432" },
        { name: "TPBank", bin: "970423" },
        { name: "Sacombank", bin: "970403" },
        { name: "ACB", bin: "970416" }
      ];

      const bank = banks.find(b => b.name === localSettings.PAYMENT_ACCOUNT.bankName);
      if (!bank) {
        alert("Ngân hàng này chưa hỗ trợ tra cứu tự động. Vui lòng nhập tên thủ công.");
        setIsCheckingBank(false);
        return;
      }

      const response = await authenticatedFetch(`/api/check-bank-account?bin=${bank.bin}&accountNumber=${localSettings.PAYMENT_ACCOUNT.accountNumber}`);
      const result = await response.json();
      
      if (response.ok && result.accountName) {
        setLocalSettings({
          ...localSettings,
          PAYMENT_ACCOUNT: {
            ...localSettings.PAYMENT_ACCOUNT,
            accountName: result.accountName
          }
        });
      } else {
        alert(result.error || "Không tìm thấy tài khoản ngân hàng");
      }
    } catch (e) {
      alert("Lỗi khi tra cứu tài khoản");
    } finally {
      setIsCheckingBank(false);
    }
  };

  const handleResetExecute = () => {
    onReset();
    setShowResetConfirm(false);
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    setImportMessage(null);
    try {
      const response = await authenticatedFetch('/api/migrate', { method: 'POST' });
      const result = await response.json();
      if (response.ok) {
        setImportMessage({ type: 'success', text: result.message });
      } else {
        setImportMessage({ type: 'error', text: result.message });
      }
    } catch (e) {
      setImportMessage({ type: 'error', text: 'Lỗi kết nối khi kiểm tra cấu trúc' });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await authenticatedFetch('/api/data?isAdmin=true');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      
      // Remove sensitive or unnecessary fields if needed
      const exportData = {
        ...data,
        exportDate: new Date().toISOString(),
        version: '1.26'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ndv_money_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('Lỗi khi xuất dữ liệu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);

          // Basic validation
          if (!data.users || !data.loans) {
            throw new Error('Định dạng file không hợp lệ');
          }
          
          const response = await authenticatedFetch('/api/import', {
            method: 'POST',
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Lỗi khi nhập dữ liệu');
          }

          setImportMessage({ type: 'success', text: 'Nhập dữ liệu thành công! Hệ thống đang cập nhật...' });
          setTimeout(() => onImportSuccess(), 1500);
        } catch (err: any) {
          setImportMessage({ type: 'error', text: err.message || 'Lỗi khi xử lý file' });
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (e) {
      setIsImporting(false);
      setImportMessage({ type: 'error', text: 'Lỗi khi đọc file' });
    }
    
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="w-full bg-black px-5 pb-10 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex items-center justify-between pt-8 mb-6 px-1">
        <h1 className="text-xl font-black text-white uppercase tracking-tighter leading-none">
          CÀI ĐẶT HỆ THỐNG
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="bg-red-600/10 border border-red-500/20 text-red-500 font-black px-3 py-2 rounded-xl text-[8px] uppercase tracking-widest hover:bg-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={12} />
            THỰC THI RESET
          </button>
          <button 
            onClick={handleMigrate}
            disabled={isMigrating}
            className="bg-blue-600/10 border border-blue-500/20 text-blue-500 font-black px-3 py-2 rounded-xl text-[8px] uppercase tracking-widest hover:bg-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            {isMigrating ? <Loader2 className="animate-spin" size={12} /> : <Database size={12} />}
            KIỂM TRA DB
          </button>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 space-y-6 mb-5">
        <div className="flex items-center gap-2.5">
          <Database className="text-[#ff8c00]" size={18} />
          <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Quản lý dữ liệu</h4>
        </div>

        {/* Backup & Restore */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-3 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
              {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            </div>
            <div className="text-center">
              <h5 className="text-[9px] font-black text-white uppercase tracking-widest">Xuất dữ liệu</h5>
              <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Sao lưu JSON</p>
            </div>
          </button>

          <button 
            onClick={handleImportClick}
            disabled={isImporting}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-3 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
              {isImporting ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
            </div>
            <div className="text-center">
              <h5 className="text-[9px] font-black text-white uppercase tracking-widest">Nhập dữ liệu</h5>
              <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Khôi phục từ file</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".json" 
              className="hidden" 
            />
          </button>
        </div>

        {importMessage && (
          <div className={`p-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
            importMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}>
            {importMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            {importMessage.text}
          </div>
        )}

        {/* Advanced Settings Section */}
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 space-y-6 mb-5">
          <div className="flex items-center gap-2.5">
            <Settings className="text-[#ff8c00]" size={18} />
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Cấu hình nâng cao</h4>
          </div>

          <div className="space-y-6">
            {/* Supabase Config */}
            <div className="space-y-4 pt-2 border-t border-white/5">
              <h5 className="text-[8px] font-black text-[#ff8c00] uppercase tracking-widest">Cấu hình Supabase</h5>
              <div className="space-y-2">
                <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Supabase URL</label>
                <input 
                  type="text" 
                  value={localSettings.SUPABASE_URL || ''}
                  onChange={(e) => setLocalSettings({...localSettings, SUPABASE_URL: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Supabase Service Role Key</label>
                <input 
                  type="password" 
                  value={localSettings.SUPABASE_SERVICE_ROLE_KEY || ''}
                  onChange={(e) => setLocalSettings({...localSettings, SUPABASE_SERVICE_ROLE_KEY: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                />
              </div>
            </div>

            {/* ImgBB Config */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h5 className="text-[8px] font-black text-[#ff8c00] uppercase tracking-widest">Cấu hình ImgBB</h5>
              <div className="space-y-2">
                <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">ImgBB API Key</label>
                <input 
                  type="text" 
                  value={localSettings.IMGBB_API_KEY || ''}
                  onChange={(e) => setLocalSettings({...localSettings, IMGBB_API_KEY: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                />
              </div>
            </div>

            {/* Payment Account Config */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h5 className="text-[8px] font-black text-[#ff8c00] uppercase tracking-widest">Tài khoản nhận thanh toán</h5>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <BankSearchableSelect 
                    value={localSettings.PAYMENT_ACCOUNT?.bankName || ''}
                    onChange={(bankName, bin) => setLocalSettings({
                      ...localSettings, 
                      PAYMENT_ACCOUNT: { ...(localSettings.PAYMENT_ACCOUNT || {}), bankName, bankBin: bin }
                    })}
                    className="w-full"
                  />
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={localSettings.PAYMENT_ACCOUNT?.accountNumber || ''}
                    onChange={(e) => setLocalSettings({
                      ...localSettings, 
                      PAYMENT_ACCOUNT: { ...(localSettings.PAYMENT_ACCOUNT || {}), accountNumber: e.target.value.replace(/\D/g, '') }
                    })}
                    className="bg-black border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={localSettings.PAYMENT_ACCOUNT?.accountName || ''}
                    onChange={(e) => setLocalSettings({
                      ...localSettings, 
                      PAYMENT_ACCOUNT: { ...(localSettings.PAYMENT_ACCOUNT || {}), accountName: e.target.value.toUpperCase() }
                    })}
                    className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-[9px] font-black text-[#ff8c00] uppercase outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-6 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h5 className="text-[8px] font-black text-[#ff8c00] uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1 h-3 bg-[#ff8c00] rounded-full" />
                  Phí & Hạn mức
                </h5>
              </div>
              
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {/* Row 1 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Phí giải ngân (%)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.PRE_DISBURSEMENT_FEE)}
                    onChange={(e) => setLocalSettings({...localSettings, PRE_DISBURSEMENT_FEE: parseNumberFromDots(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Gia hạn tối đa</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_EXTENSIONS)}
                    onChange={(e) => setLocalSettings({...localSettings, MAX_EXTENSIONS: parseNumberFromDots(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>

                {/* Row 2 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Phí nâng hạng (%)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.UPGRADE_PERCENT)}
                    onChange={(e) => setLocalSettings({...localSettings, UPGRADE_PERCENT: parseNumberFromDots(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Phí quá hạn (%/ngày)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={localSettings.FINE_RATE || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setLocalSettings({...localSettings, FINE_RATE: val});
                      }
                    }}
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>

                {/* Row 3 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Phạt tối đa (%)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_FINE_PERCENT)}
                    onChange={(e) => setLocalSettings({...localSettings, MAX_FINE_PERCENT: parseNumberFromDots(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Hạn mức chu kỳ</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_LOAN_PER_CYCLE)}
                    onChange={(e) => setLocalSettings({...localSettings, MAX_LOAN_PER_CYCLE: parseNumberFromDots(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>

                {/* Row 4 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Ngân sách tối thiểu</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MIN_SYSTEM_BUDGET)}
                    onChange={(e) => setLocalSettings({...localSettings, MIN_SYSTEM_BUDGET: parseNumberFromDots(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Hạn mức vay tối đa</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_SINGLE_LOAN_AMOUNT)}
                    onChange={(e) => setLocalSettings({...localSettings, MAX_SINGLE_LOAN_AMOUNT: parseNumberFromDots(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]/50 focus:bg-white/10 transition-all"
                  />
                </div>
              </div>
            </div>

            {settingsMessage && (
              <div className={`p-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
                settingsMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                {settingsMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                {settingsMessage.text}
              </div>
            )}

            <button 
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="w-full bg-[#ff8c00] hover:bg-[#e67e00] text-black font-black py-4 rounded-xl text-[9px] uppercase tracking-[0.2em] shadow-lg shadow-orange-900/20 active:scale-95 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Lưu và Áp dụng cấu hình
            </button>
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <div className="mt-10 text-center opacity-30">
        <p className="text-[7px] font-black text-gray-500 uppercase tracking-[0.3em]">System Kernel v1.26 PRO</p>
      </div>

      {/* Popup xác nhận Reset hệ thống */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#111111] border border-red-500/20 w-full max-w-sm rounded-3xl p-6 space-y-6 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-red-600/10 rounded-full flex items-center justify-center text-red-600">
                 <AlertCircle size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">RESET HỆ THỐNG?</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed px-3">
                  Thao tác này sẽ <span className="text-red-500 font-black">XÓA VĨNH VIỄN</span> toàn bộ khách hàng, lịch sử vay và logs. Ngân sách sẽ quay về <span className="text-white font-black">30.000.000 đ</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
               <button 
                 onClick={() => setShowResetConfirm(false)}
                 className="flex-1 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={12} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleResetExecute}
                 className="flex-1 py-3.5 bg-red-600 rounded-xl text-[9px] font-black text-white uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
               >
                 <Check size={12} /> ĐỒNG Ý RESET
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystem;
