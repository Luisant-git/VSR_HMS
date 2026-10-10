import React, { useState, useEffect } from 'react';
import {
  Package, Tag, Scale, Truck, CreditCard,
  ShoppingCart, FileText, Plus, Edit, Trash2, Search, CheckCircle,
  X, Eye, RefreshCw, PlusCircle, RotateCcw, List, Grid, Maximize, Minimize, Download
} from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { PageHeader } from '../components/PageHeader';
import { CanteenAPI } from '../api/canteen.api';
import { SearchableSelect } from '../components/SearchableSelect';
import { Pagination } from '../components/Pagination';
import { CanteenSupplierPayments } from '../components/CanteenSupplierPayments';
import * as XLSX from 'xlsx';
interface PurchaseItemRow {
  productId: string;
  productName: string;
  qty: number;
  unit: string;
  price: number;
  totalAmount: number;
}

export default function CanteenMaster() {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'units' | 'suppliers' | 'payment-modes' | 'purchase-entry' | 'purchase-reports' | 'supplier-payments'>('products');

  const [permissions, setPermissions] = useState<any>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role) {
          import('../api/menuPermission.api').then(({ MenuPermissionAPI }) => {
            MenuPermissionAPI.getByRole(payload.role).then(res => {
              if (res) {
                setPermissions(res.permissions || res);
              }
            });
          });
        }
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    if (permissions) {
      const availableTabs = [
        { id: 'products', permKey: 'canteen_products' },
        { id: 'categories', permKey: 'canteen_categories' },
        { id: 'units', permKey: 'canteen_units' },
        { id: 'suppliers', permKey: 'canteen_suppliers' },
        { id: 'payment-modes', permKey: 'canteen_payment_modes' },
        { id: 'purchase-entry', permKey: 'canteen_purchase_entry' },
        { id: 'supplier-payments', permKey: 'canteen_supplier_payments' },
        { id: 'purchase-reports', permKey: 'canteen_purchase_reports' }
      ].filter(t => permissions[t.permKey] === true);

      if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
        setActiveTab(availableTabs[0].id as any);
      }
    }
  }, [permissions, activeTab]);

  // Loading states
  const [loading, setLoading] = useState(false);

  // Master Data states
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);

  // Search & Layout filter & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Master Modals & Forms
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'product' | 'category' | 'unit' | 'supplier' | 'payment-mode'>('product');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  // View purchase modal
  const [viewPurchase, setViewPurchase] = useState<any>(null);

  // View Master Details Modal
  const [viewMasterItem, setViewMasterItem] = useState<any>(null);
  const [viewMasterType, setViewMasterType] = useState<string>('');

  // Purchase Entry Form State (POS-Suite360 Style Multi-row Grid)
  const [purchaseHeader, setPurchaseHeader] = useState({
    supplierId: '',
    paymentModeId: '',
    purchaseDate: new Date().toISOString().substring(0, 10),
    notes: ''
  });

  const [purchaseRows, setPurchaseRows] = useState<PurchaseItemRow[]>([
    { productId: '', productName: '', qty: 1, unit: 'Pkt', price: 0, totalAmount: 0 }
  ]);

  // Helper to map tab name to modal type safely
  const getModalType = (tab: string): 'product' | 'category' | 'unit' | 'supplier' | 'payment-mode' => {
    if (tab === 'categories') return 'category';
    if (tab === 'products') return 'product';
    if (tab === 'units') return 'unit';
    if (tab === 'suppliers') return 'supplier';
    if (tab === 'payment-modes') return 'payment-mode';
    return 'product';
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [prods, cats, unts, supps, pmodes, purcs] = await Promise.all([
        CanteenAPI.getProducts(),
        CanteenAPI.getCategories(),
        CanteenAPI.getUnits(),
        CanteenAPI.getSuppliers(),
        CanteenAPI.getPaymentModes(),
        CanteenAPI.getPurchases(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setUnits(unts);
      setSuppliers(supps);
      setPaymentModes(pmodes);
      setPurchases(purcs);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load canteen data.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Options for SearchableSelect
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const unitOptions = units.map(u => ({ value: u.id, label: u.name, sublabel: u.symbol ? `(${u.symbol})` : '' }));
  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name, sublabel: s.phone ? `Ph: ${s.phone}` : '' }));
  const paymentModeOptions = paymentModes.map(pm => ({ value: pm.id, label: pm.name }));
  const productOptions = products
    .filter(p => p.status !== 'Inactive')
    .map(p => ({
      value: p.id,
      label: p.code ? `${p.code} - ${p.name}` : p.name,
      sublabel: `₹${p.price}`
    }));

  const purchaseUnitOptions = [
    { value: 'Pkt', label: 'Pkt' },
    { value: 'kg', label: 'kg' },
    { value: 'ltr', label: 'ltr' },
    { value: 'pc', label: 'pc' },
    { value: 'box', label: 'box' },
    { value: 'btl', label: 'btl' },
    ...units.map(u => ({ value: u.symbol || u.name, label: u.symbol || u.name }))
  ];

  // Paginated Data Helpers
  const getActiveTabData = () => {
    let list: any[] = [];
    if (activeTab === 'products') {
      list = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchCategory = filterCategory ? (p.categoryId === filterCategory || (p.category && p.category.id === filterCategory)) : true;
        const matchStatus = filterStatus ? p.status === filterStatus : true;
        return matchSearch && matchCategory && matchStatus;
      });
    } else if (activeTab === 'categories') {
      list = categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    } else if (activeTab === 'units') {
      list = units.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
    } else if (activeTab === 'suppliers') {
      list = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.gstNo && s.gstNo.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else if (activeTab === 'payment-modes') {
      list = paymentModes.filter(pm => pm.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedList = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return { list, paginatedList, totalItems, totalPages };
  };

  const getPurchaseReportData = () => {
    let list = purchases.filter(p => p.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) || (p.supplier?.name && p.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())));
    if (filterSupplier) list = list.filter(p => p.supplierId === filterSupplier);
    if (filterPaymentMode) list = list.filter(p => p.paymentModeId === filterPaymentMode);
    if (filterFromDate) list = list.filter(p => new Date(p.purchaseDate) >= new Date(filterFromDate));
    if (filterToDate) list = list.filter(p => new Date(p.purchaseDate) <= new Date(filterToDate));
    
    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedList = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return { list, paginatedList, totalItems, totalPages };
  };

  const getNextProductCode = () => {
    const pCodes = products
      .filter(p => p.code && p.code.startsWith('P'))
      .map(p => parseInt(p.code.substring(1), 10))
      .filter(n => !isNaN(n));
    const maxNumber = pCodes.length > 0 ? Math.max(...pCodes) : 0;
    return `P${(maxNumber + 1).toString().padStart(6, '0')}`;
  };

  const getNextEntryNo = () => {
    return `PUR-${new Date().getFullYear()}-${(purchases.length + 1).toString().padStart(4, '0')}`;
  };

  const handleRowProductSelect = (index: number, prodId: string) => {
    const selected = products.find(p => p.id === prodId);
    const updated = [...purchaseRows];
    if (selected) {
      updated[index] = {
        ...updated[index],
        productId: selected.id,
        productName: selected.name,
        unit: selected.unit?.symbol || selected.unit?.name || 'Pkt',
        price: selected.price || 0,
        totalAmount: (updated[index].qty || 1) * (selected.price || 0)
      };
    } else {
      updated[index] = {
        ...updated[index],
        productId: '',
        productName: '',
        price: 0,
        totalAmount: 0
      };
    }
    setPurchaseRows(updated);
  };

  // Handle row field change
  const handleRowChange = (index: number, field: keyof PurchaseItemRow, val: any) => {
    const updated = [...purchaseRows];
    const row = { ...updated[index], [field]: val };

    if (field === 'qty' || field === 'price') {
      const q = Number(field === 'qty' ? val : row.qty) || 0;
      const p = Number(field === 'price' ? val : row.price) || 0;
      row.totalAmount = q * p;
    }

    updated[index] = row;
    setPurchaseRows(updated);
  };

  // Add Row to Purchase Entry
  const handleAddRow = () => {
    setPurchaseRows([
      ...purchaseRows,
      { productId: '', productName: '', qty: 1, unit: 'Pkt', price: 0, totalAmount: 0 }
    ]);
  };

  // Add Row after specific index
  const handleAddRowAfter = (index: number) => {
    const newRow: PurchaseItemRow = { productId: '', productName: '', qty: 1, unit: 'Pkt', price: 0, totalAmount: 0 };
    const updated = [...purchaseRows];
    updated.splice(index + 1, 0, newRow);
    setPurchaseRows(updated);
  };

  // Remove Row
  const handleRemoveRow = (index: number) => {
    if (purchaseRows.length === 1) {
      toast.warning('Purchase entry must have at least one item row.');
      return;
    }
    setPurchaseRows(purchaseRows.filter((_, i) => i !== index));
  };

  // Clear Purchase Form
  const handleClearPurchaseForm = () => {
    setPurchaseHeader({
      supplierId: '',
      paymentModeId: '',
      purchaseDate: new Date().toISOString().substring(0, 10),
      notes: ''
    });
    setPurchaseRows([
      { productId: '', productName: '', qty: 1, unit: 'Pkt', price: 0, totalAmount: 0 }
    ]);
  };

  const calculateTotalQuantity = () => {
    return purchaseRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  };

  const calculateTotalAmount = () => {
    return purchaseRows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  };

  // Calculate Net Purchase Total
  const calculateGrandTotal = () => {
    return calculateTotalAmount();
  };

  // Submit Purchase Entry
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!purchaseHeader.supplierId || purchaseHeader.supplierId.trim() === '') {
      toast.error('⚠️ Please select a Supplier before submitting the Purchase Entry.');
      return;
    }

    if (!purchaseHeader.paymentModeId || purchaseHeader.paymentModeId.trim() === '') {
      toast.error('⚠️ Please select a Payment Mode before submitting the Purchase Entry.');
      return;
    }

    const validItems = purchaseRows.filter(r => r.productName && r.productName.trim() !== '' && Number(r.qty) > 0);
    if (validItems.length === 0) {
      toast.error('Please enter at least one valid product with quantity > 0.');
      return;
    }

    try {
      const payload = {
        supplierId: purchaseHeader.supplierId || undefined,
        paymentModeId: purchaseHeader.paymentModeId || undefined,
        purchaseDate: purchaseHeader.purchaseDate,
        notes: purchaseHeader.notes,
        items: validItems.map(r => ({
          productId: r.productId || undefined,
          productName: r.productName,
          qty: Number(r.qty),
          unit: r.unit,
          price: Number(r.price)
        }))
      };

      await CanteenAPI.createPurchase(payload);
      toast.success('🎉 Purchase Entry saved successfully!');

      handleClearPurchaseForm();
      await loadAllData();
      setActiveTab('purchase-reports');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit purchase entry');
    }
  };

  // Open Modal for Create / Edit Master Item
  const handleOpenModal = (type: typeof modalType, item: any = null) => {
    setModalType(type);
    setEditingItem(item);
    if (item) {
      setFormData({
        ...item,
        categoryId: item.categoryId || item.category?.id || '',
        unitId: item.unitId || item.unit?.id || ''
      });
    } else {
      if (type === 'product') {
        setFormData({ name: '', code: '', categoryId: '', unitId: '', price: 0, costPrice: 0, stock: 0, status: 'Active' });
      } else if (type === 'category') {
        setFormData({ name: '', description: '' });
      } else if (type === 'unit') {
        setFormData({ name: '', symbol: '' });
      } else if (type === 'supplier') {
        setFormData({ name: '', phone: '', email: '', address: '', gstNo: '' });
      } else if (type === 'payment-mode') {
        setFormData({ name: '' });
      }
    }
    setShowModal(true);
  };

  // Save Master Item from Form or Modal
  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'product') {
        if (editingItem) await CanteenAPI.updateProduct(editingItem.id, formData);
        else await CanteenAPI.createProduct(formData);
      } else if (modalType === 'category') {
        if (editingItem) await CanteenAPI.updateCategory(editingItem.id, formData);
        else await CanteenAPI.createCategory(formData);
      } else if (modalType === 'unit') {
        if (editingItem) await CanteenAPI.updateUnit(editingItem.id, formData);
        else await CanteenAPI.createUnit(formData);
      } else if (modalType === 'supplier') {
        if (editingItem) await CanteenAPI.updateSupplier(editingItem.id, formData);
        else await CanteenAPI.createSupplier(formData);
      } else if (modalType === 'payment-mode') {
        if (editingItem) await CanteenAPI.updatePaymentMode(editingItem.id, formData);
        else await CanteenAPI.createPaymentMode(formData);
      }

      toast.success(`${modalType.toUpperCase()} saved successfully!`);
      setShowModal(false);
      setEditingItem(null);
      setFormData({});
      loadAllData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save record.');
    }
  };

  // Delete Item
  const handleDeleteItem = (type: string, id: string, name: string) => {
    Swal.fire({
      title: 'Delete Item?',
      text: `Are you sure you want to delete "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Delete'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          if (type === 'product') await CanteenAPI.deleteProduct(id);
          else if (type === 'category') await CanteenAPI.deleteCategory(id);
          else if (type === 'unit') await CanteenAPI.deleteUnit(id);
          else if (type === 'supplier') await CanteenAPI.deleteSupplier(id);
          else if (type === 'payment-mode') await CanteenAPI.deletePaymentMode(id);
          else if (type === 'purchase') await CanteenAPI.deletePurchase(id);

          toast.success(`Deleted successfully!`);
          loadAllData();
        } catch (err: any) {
          toast.error(err.response?.data?.message || err.message || 'Failed to delete');
        }
      }
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#f5f7fa', padding: '10px 32px 40px 32px', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' }}>
      <PageHeader
        title="Canteen & Inventory Master"
        subtitle="Complete canteen management suite — products, categories, units, suppliers, payment modes & purchase entry"
        rightContent={
          <button
            onClick={loadAllData}
            disabled={loading}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'white',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Loading...' : 'Refresh'}
          </button>
        }
      />

      {/* POS-Suite360 Style Tab Navigation Header */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
        {[
          { id: 'products', label: 'Products Master', icon: <Package size={16} />, permKey: 'canteen_products' },
          { id: 'categories', label: 'Categories', icon: <Tag size={16} />, permKey: 'canteen_categories' },
          { id: 'units', label: 'Units', icon: <Scale size={16} />, permKey: 'canteen_units' },
          { id: 'suppliers', label: 'Suppliers', icon: <Truck size={16} />, permKey: 'canteen_suppliers' },
          { id: 'payment-modes', label: 'Payment Modes', icon: <CreditCard size={16} />, permKey: 'canteen_payment_modes' },
          { id: 'purchase-entry', label: 'Purchase Entry', icon: <ShoppingCart size={16} />, highlight: true, permKey: 'canteen_purchase_entry' },
          { id: 'supplier-payments', label: 'Supplier Payments', icon: <FileText size={16} />, highlight: true, permKey: 'canteen_supplier_payments' },
          { id: 'purchase-reports', label: 'Purchase Reports', icon: <FileText size={16} />, permKey: 'canteen_purchase_reports' }
        ].filter(tab => !permissions || permissions[tab.permKey] === true).map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setEditingItem(null);
              setFormData({});
            }}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? (tab.highlight ? '#10b981' : 'var(--sidebar-active)') : 'white',
              color: activeTab === tab.id ? 'white' : '#475569',
              border: activeTab === tab.id ? 'none' : '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'supplier-payments' && (
        <CanteenSupplierPayments suppliers={suppliers} paymentModes={paymentModes} />
      )}

      {/* POS-Suite360 Style Split Grid View for Masters */}
      {activeTab !== 'purchase-entry' && activeTab !== 'purchase-reports' && activeTab !== 'supplier-payments' && (
        <div style={{ display: 'grid', gridTemplateColumns: isFullTable ? '1fr' : '320px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* POS-Suite360 Left Column: Master Form Panel */}
          {!isFullTable && (
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #E6E9ED', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ background: '#3B82F6', color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {editingItem ? 'EDIT' : 'ADD NEW'} {getModalType(activeTab).toUpperCase()} FORM
                </h3>
              </div>

              <form onSubmit={handleSaveMaster} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Category Form */}
                {activeTab === 'categories' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>
                        Category Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter category name"
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Description</label>
                      <textarea
                        rows={3}
                        placeholder="Optional description"
                        value={formData.description || ''}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                  </>
                )}

                {/* Unit Form */}
                {activeTab === 'units' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Unit Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kilogram, Liter, Piece"
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Symbol / Abbr</label>
                      <input
                        type="text"
                        placeholder="e.g. kg, ltr, pc, pkt"
                        value={formData.symbol || ''}
                        onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                  </>
                )}

                {/* Supplier Form */}
                {activeTab === 'suppliers' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Supplier Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter supplier business name"
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Phone Number</label>
                      <input
                        type="text"
                        placeholder="Mobile or phone number"
                        value={formData.phone || ''}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>GST Number</label>
                      <input
                        type="text"
                        placeholder="GSTIN number"
                        value={formData.gstNo || ''}
                        onChange={e => setFormData({ ...formData, gstNo: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                  </>
                )}

                {/* Payment Mode Form */}
                {activeTab === 'payment-modes' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Payment Mode Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UPI, Cash, Paytm, Card"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                )}

                {/* Products Form */}
                {activeTab === 'products' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Product Code *</label>
                      <input
                        type="text"
                        value={editingItem ? (formData.code || '') : getNextProductCode()}
                        readOnly={!editingItem}
                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none', background: !editingItem ? '#f1f5f9' : 'white', color: !editingItem ? '#1e293b' : '#000', fontWeight: !editingItem ? 700 : 'normal' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter item name"
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Category</label>
                      <SearchableSelect
                        options={categoryOptions}
                        value={formData.categoryId || ''}
                        onChange={val => setFormData({ ...formData, categoryId: val })}
                        placeholder="Search category..."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Unit (from Master)</label>
                      <SearchableSelect
                        options={unitOptions}
                        value={formData.unitId || ''}
                        onChange={val => setFormData({ ...formData, unitId: val })}
                        placeholder="Search unit..."
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Price (₹)</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.price || 0}
                          onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '4px' }}>Status</label>
                      <SearchableSelect
                        options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
                        value={formData.status || 'Active'}
                        onChange={val => setFormData({ ...formData, status: val })}
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '4px',
                    background: '#16A34A',
                    color: 'white',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '10px'
                  }}
                >
                  <CheckCircle size={16} />
                  {editingItem ? 'UPDATE RECORD' : 'SAVE RECORD'}
                </button>

                {editingItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setFormData({});
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      background: '#6B7280',
                      color: 'white',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    CANCEL EDIT
                  </button>
                )}
              </form>
            </div>
          )}

          {/* POS-Suite360 Right Column: Data Table Panel */}
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #E6E9ED', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

            {/* Table Action Bar */}
            <div style={{ background: '#F9F9F9', borderBottom: '1px solid #E6E9ED', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Grid size={18} color="#3B82F6" />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1F2937', textTransform: 'uppercase' }}>
                  {activeTab.replace('-', ' ')} LIST
                </h3>
                <span style={{ background: '#6B7280', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                  {activeTab === 'products' && `${products.length} Products`}
                  {activeTab === 'categories' && `${categories.length} Categories`}
                  {activeTab === 'units' && `${units.length} Units`}
                  {activeTab === 'suppliers' && `${suppliers.length} Suppliers`}
                  {activeTab === 'payment-modes' && `${paymentModes.length} Payment Modes`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab.replace('-', ' ')}...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: '4px', border: '1px solid #CCC', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                {activeTab === 'products' && (
                  <>
                    <SearchableSelect
                      options={categoryOptions}
                      value={filterCategory}
                      onChange={val => setFilterCategory(val)}
                      placeholder="All Categories"
                      width="180px"
                    />
                    <SearchableSelect
                      options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
                      value={filterStatus}
                      onChange={val => setFilterStatus(val)}
                      placeholder="All Statuses"
                      width="150px"
                    />
                  </>
                )}
                {(searchTerm || filterCategory || filterStatus) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterCategory('');
                      setFilterStatus('');
                    }}
                    title="Clear Filters"
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #EF4444', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={14} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullTable(!isFullTable)}
                  style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #3B82F6', background: '#EFF6FF', color: '#3B82F6', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isFullTable ? <Minimize size={14} /> : <Maximize size={14} />}
                  {isFullTable ? 'Show Form' : 'View Full Table'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenModal(getModalType(activeTab))}
                  style={{ padding: '6px 12px', borderRadius: '4px', background: '#3B82F6', color: 'white', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Add Modal
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white', fontWeight: 700 }}>
                    {activeTab === 'products' && (
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Code</th>
                    )}
                    <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Name / Title</th>
                    {activeTab === 'products' && (
                      <>
                        <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Category</th>
                        <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Unit</th>
                        <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Price (₹)</th>
                        <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Status</th>
                      </>
                    )}
                    {activeTab === 'categories' && (
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Description</th>
                    )}
                    {activeTab === 'units' && (
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Symbol</th>
                    )}
                    {activeTab === 'suppliers' && (
                      <>
                        <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Phone</th>
                        <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>GST No</th>
                      </>
                    )}
                    {activeTab === 'payment-modes' && (
                      <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Type</th>
                    )}
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '130px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Products List */}
                  {activeTab === 'products' && getActiveTabData().paginatedList.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #E5E7EB', background: idx % 2 === 0 ? '#F9F9F9' : '#FFFFFF' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{p.code || '-'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B82F6' }}>{p.name}</td>
                      <td style={{ padding: '10px 14px' }}><span style={{ background: '#E0F2FE', color: '#0369A1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>{p.category?.name || '-'}</span></td>
                      <td style={{ padding: '10px 14px' }}><span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{p.unit?.symbol || p.unit?.name || '-'}</span></td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16A34A' }}>₹{p.price}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: p.status === 'Inactive' ? '#EF4444' : '#16A34A', background: p.status === 'Inactive' ? '#FEF2F2' : '#F0FDF4' }}>
                          {p.status || 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setViewMasterItem(p); setViewMasterType('Product'); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10B981', background: '#ECFDF5', color: '#10B981', marginRight: '6px', cursor: 'pointer' }}><Eye size={14} /></button>
                        <button onClick={() => { setEditingItem(p); setFormData({ ...p, categoryId: p.categoryId || p.category?.id || '', unitId: p.unitId || p.unit?.id || '' }); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3B82F6', background: '#EFF6FF', color: '#3B82F6', marginRight: '6px', cursor: 'pointer' }}><Edit size={14} /></button>
                        <button onClick={() => handleDeleteItem('product', p.id, p.name)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #EF4444', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}

                  {/* Categories List */}
                  {activeTab === 'categories' && getActiveTabData().paginatedList.map((c, idx) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #E5E7EB', background: idx % 2 === 0 ? '#F9F9F9' : '#FFFFFF' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B82F6' }}>{c.name}</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>{c.description || '-'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setViewMasterItem(c); setViewMasterType('Category'); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10B981', background: '#ECFDF5', color: '#10B981', marginRight: '6px', cursor: 'pointer' }}><Eye size={14} /></button>
                        <button onClick={() => { setEditingItem(c); setFormData({ ...c }); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3B82F6', background: '#EFF6FF', color: '#3B82F6', marginRight: '6px', cursor: 'pointer' }}><Edit size={14} /></button>
                        <button onClick={() => handleDeleteItem('category', c.id, c.name)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #EF4444', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}

                  {/* Units List */}
                  {activeTab === 'units' && getActiveTabData().paginatedList.map((u, idx) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #E5E7EB', background: idx % 2 === 0 ? '#F9F9F9' : '#FFFFFF' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B82F6' }}>{u.name}</td>
                      <td style={{ padding: '10px 14px', color: '#0369A1', fontWeight: 700 }}>{u.symbol || '-'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setViewMasterItem(u); setViewMasterType('Unit'); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10B981', background: '#ECFDF5', color: '#10B981', marginRight: '6px', cursor: 'pointer' }}><Eye size={14} /></button>
                        <button onClick={() => { setEditingItem(u); setFormData({ ...u }); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3B82F6', background: '#EFF6FF', color: '#3B82F6', marginRight: '6px', cursor: 'pointer' }}><Edit size={14} /></button>
                        <button onClick={() => handleDeleteItem('unit', u.id, u.name)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #EF4444', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}

                  {/* Suppliers List */}
                  {activeTab === 'suppliers' && getActiveTabData().paginatedList.map((s, idx) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #E5E7EB', background: idx % 2 === 0 ? '#F9F9F9' : '#FFFFFF' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B82F6' }}>{s.name}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{s.phone || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#0369A1', fontWeight: 600 }}>{s.gstNo || '-'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setViewMasterItem(s); setViewMasterType('Supplier'); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10B981', background: '#ECFDF5', color: '#10B981', marginRight: '6px', cursor: 'pointer' }}><Eye size={14} /></button>
                        <button onClick={() => { setEditingItem(s); setFormData({ ...s }); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3B82F6', background: '#EFF6FF', color: '#3B82F6', marginRight: '6px', cursor: 'pointer' }}><Edit size={14} /></button>
                        <button onClick={() => handleDeleteItem('supplier', s.id, s.name)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #EF4444', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}

                  {/* Payment Modes List */}
                  {activeTab === 'payment-modes' && getActiveTabData().paginatedList.map((pm, idx) => (
                    <tr key={pm.id} style={{ borderBottom: '1px solid #E5E7EB', background: idx % 2 === 0 ? '#F9F9F9' : '#FFFFFF' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B82F6' }}>{pm.name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: pm.isSystem ? '#E0F2FE' : '#F1F5F9', color: pm.isSystem ? '#0369A1' : '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          {pm.isSystem ? 'System Default' : 'Custom'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setViewMasterItem(pm); setViewMasterType('Payment Mode'); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #10B981', background: '#ECFDF5', color: '#10B981', marginRight: '6px', cursor: 'pointer' }}><Eye size={14} /></button>
                        <button onClick={() => { setEditingItem(pm); setFormData({ ...pm }); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3B82F6', background: '#EFF6FF', color: '#3B82F6', marginRight: '6px', cursor: 'pointer' }}><Edit size={14} /></button>
                        {!pm.isSystem && (
                          <button onClick={() => handleDeleteItem('payment-mode', pm.id, pm.name)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #EF4444', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={getActiveTabData().totalPages}
              totalItems={getActiveTabData().totalItems}
              itemsPerPage={pageSize}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setPageSize}
            />
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* PURCHASE ENTRY FORM TAB (POS-Suite360 Grid & Style) */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'purchase-entry' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden' }}>

          {/* Header Panel */}
          <div style={{ background: '#F8FAFC', padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart color="#10b981" size={22} /> Purchase Entry
              </h3>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleAddRow}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'white', border: '1px solid #0F172A', color: '#0F172A', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <PlusCircle size={16} /> Add Row
                </button>
                <button
                  type="button"
                  onClick={handleClearPurchaseForm}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'white', border: '1px solid #EF4444', color: '#EF4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw size={16} /> Clear Form
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('purchase-reports')}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'white', border: '1px solid #334155', color: '#334155', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <List size={16} /> Purchase Reports
                </button>
              </div>
            </div>

            {/* Form Top Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Entry No</label>
                <input
                  type="text"
                  readOnly
                  value={getNextEntryNo()}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#1e293b', fontSize: '13px', outline: 'none', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Supplier <span style={{ color: '#EF4444' }}>*</span></label>
                <SearchableSelect
                  options={supplierOptions}
                  value={purchaseHeader.supplierId}
                  onChange={val => setPurchaseHeader({ ...purchaseHeader, supplierId: val })}
                  placeholder="-- Search Supplier --"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Payment Mode <span style={{ color: '#EF4444' }}>*</span></label>
                <SearchableSelect
                  options={paymentModeOptions}
                  value={purchaseHeader.paymentModeId}
                  onChange={val => setPurchaseHeader({ ...purchaseHeader, paymentModeId: val })}
                  placeholder="-- Search Payment Mode --"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Purchase Date</label>
                <input
                  type="date"
                  value={purchaseHeader.purchaseDate}
                  onChange={e => setPurchaseHeader({ ...purchaseHeader, purchaseDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #, Bill memo, remarks"
                  value={purchaseHeader.notes}
                  onChange={e => setPurchaseHeader({ ...purchaseHeader, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* POS-Suite360 Items Multi-Row Table */}
          <form onSubmit={handlePurchaseSubmit}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white' }}>
                    <th style={{ padding: '10px 14px', width: '50px', textAlign: 'center', borderRight: '1px solid #334155' }}>#</th>
                    <th style={{ padding: '10px 14px', borderRight: '1px solid #334155' }}>Product Name</th>
                    <th style={{ padding: '10px 14px', width: '120px', borderRight: '1px solid #334155' }}>Quantity</th>
                    <th style={{ padding: '10px 14px', width: '160px', borderRight: '1px solid #334155' }}>Unit</th>
                    <th style={{ padding: '10px 14px', width: '140px', borderRight: '1px solid #334155' }}>Price / Unit (₹)</th>
                    <th style={{ padding: '10px 14px', width: '150px', borderRight: '1px solid #334155', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '10px 14px', width: '70px', textAlign: 'center' }}>Act</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>

                      <td style={{ padding: '8px 14px' }}>
                        <SearchableSelect
                          options={productOptions}
                          value={row.productId}
                          onChange={val => handleRowProductSelect(idx, val)}
                          placeholder="-- Search & Select Product --"
                        />
                      </td>

                      <td style={{ padding: '8px 14px' }}>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          required
                          value={row.qty}
                          onChange={e => handleRowChange(idx, 'qty', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', outline: 'none', fontWeight: 700 }}
                        />
                      </td>

                      <td style={{ padding: '8px 14px' }}>
                        <SearchableSelect
                          options={purchaseUnitOptions}
                          value={row.unit}
                          onChange={val => handleRowChange(idx, 'unit', val)}
                          placeholder="Select Unit"
                          disabled={!!row.productId}
                        />
                      </td>

                      <td style={{ padding: '8px 14px' }}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={row.price}
                          onChange={e => handleRowChange(idx, 'price', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'right', outline: 'none', fontWeight: 700 }}
                        />
                      </td>

                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: '14px' }}>
                        ₹{(Number(row.totalAmount) || 0).toFixed(2)}
                      </td>

                      <td style={{ padding: '8px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleAddRowAfter(idx)}
                          title="Add row below"
                          style={{ padding: '4px 8px', borderRadius: '4px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', cursor: 'pointer', marginRight: '6px' }}
                        >
                          <Plus size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          title="Delete row"
                          style={{ padding: '4px 8px', borderRadius: '4px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', cursor: 'pointer' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Summary & Save Panel */}
            <div style={{ padding: '30px', background: '#F8FAFC', borderTop: '2px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '30px', marginBottom: '20px', borderRadius: '0 0 12px 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', maxWidth: '400px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Total Quantity:</label>
                  <input type="text" readOnly value={calculateTotalQuantity()} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '15px', fontWeight: 800, textAlign: 'right', color: '#0F172A', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Total Amount:</label>
                  <input type="text" readOnly value={calculateTotalAmount().toFixed(2)} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '15px', fontWeight: 800, textAlign: 'right', color: '#0F172A', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #E2E8F0', paddingTop: '24px', marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={handleAddRow} style={{ padding: '8px 16px', background: '#3B82F6', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>F2 Add Row</button>
                  <button type="submit" style={{ padding: '8px 16px', background: '#10B981', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} /> F10 Save Purchase</button>
                  <button type="button" onClick={() => setActiveTab('products')} style={{ padding: '8px 16px', background: '#0ea5e9', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Esc Dashboard</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#1F2937', textTransform: 'uppercase' }}>Net Purchase Amount:</span>
                  <span style={{ fontSize: '32px', fontWeight: 900, color: '#10B981' }}>₹ {calculateGrandTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* PURCHASE REPORTS TAB */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'purchase-reports' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          {/* Purchase Reports Filters */}
          <div style={{ padding: '16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Show</label>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', cursor: 'pointer', backgroundColor: 'white' }}>
                <option value={10}>10 Entries</option>
                <option value={25}>25 Entries</option>
                <option value={50}>50 Entries</option>
                <option value={100}>100 Entries</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Search</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input type="text" placeholder="Search Invoice/Supplier..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Supplier</label>
              <SearchableSelect options={supplierOptions} value={filterSupplier} onChange={setFilterSupplier} placeholder="All Suppliers" />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>Payment Mode</label>
              <SearchableSelect options={paymentModeOptions} value={filterPaymentMode} onChange={setFilterPaymentMode} placeholder="All Payment Modes" />
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>From Date</label>
              <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }} />
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1F2937', marginBottom: '4px', textTransform: 'uppercase' }}>To Date</label>
              <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(searchTerm || filterSupplier || filterPaymentMode || filterFromDate || filterToDate) && (
                <button onClick={() => { setSearchTerm(''); setFilterSupplier(''); setFilterPaymentMode(''); setFilterFromDate(''); setFilterToDate(''); }} style={{ padding: '8px', borderRadius: '6px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', height: '34px', boxSizing: 'border-box' }} title="Clear Filters">
                  <X size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  let filtered = purchases;
                  if (searchTerm) {
                    const lower = searchTerm.toLowerCase();
                    filtered = filtered.filter(p => p.invoiceNo.toLowerCase().includes(lower) || p.supplier?.name?.toLowerCase().includes(lower));
                  }
                  if (filterSupplier) filtered = filtered.filter(p => p.supplier?.id === filterSupplier);
                  if (filterPaymentMode) filtered = filtered.filter(p => p.paymentMode?.name === filterPaymentMode || p.paymentMode?.id === filterPaymentMode);
                  if (filterFromDate) filtered = filtered.filter(p => new Date(p.purchaseDate) >= new Date(filterFromDate));
                  if (filterToDate) filtered = filtered.filter(p => new Date(p.purchaseDate) <= new Date(filterToDate));
                  
                  const exportData: any[] = filtered.map((p: any) => {
                    const d = new Date(p.purchaseDate);
                    const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                    return {
                      'Entry No': p.invoiceNo,
                      'Purchase Date': formattedDate,
                      'Supplier': p.supplier?.name || '-',
                      'Payment Mode': p.paymentMode?.name || '-',
                      'Total Items': p.items?.length || 0,
                      'Total Amount': p.totalAmount
                    };
                  });
                  
                  const totalAmount = exportData.reduce((sum: number, row: any) => sum + (row['Total Amount'] || 0), 0);
                  exportData.push({
                    'Entry No': 'TOTAL',
                    'Purchase Date': '',
                    'Supplier': '',
                    'Payment Mode': '',
                    'Total Items': '',
                    'Total Amount': totalAmount
                  });
                  const ws = XLSX.utils.json_to_sheet(exportData);
                  
                  // Set column widths to prevent visual overflow
                  ws['!cols'] = [
                    { wch: 18 }, // Entry No
                    { wch: 15 }, // Purchase Date
                    { wch: 30 }, // Supplier
                    { wch: 18 }, // Payment Mode
                    { wch: 15 }, // Total Items
                    { wch: 15 }  // Total Amount
                  ];
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Purchase Report");
                  XLSX.writeFile(wb, "Purchase_Report.xlsx");
                }}
                style={{ backgroundColor: '#1D4ED8', color: 'white', border: 'none', borderRadius: '6px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                title="Export Excel"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#0F172A', color: 'white', fontWeight: 600 }}>
                <th style={{ padding: '14px 18px', borderRight: '1px solid #334155' }}>Entry No</th>
                <th style={{ padding: '14px 18px', borderRight: '1px solid #334155' }}>Purchase Date</th>
                <th style={{ padding: '14px 18px', borderRight: '1px solid #334155' }}>Supplier</th>
                <th style={{ padding: '14px 18px', borderRight: '1px solid #334155' }}>Payment Mode</th>
                <th style={{ padding: '14px 18px', borderRight: '1px solid #334155' }}>Total Items</th>
                <th style={{ padding: '14px 18px', borderRight: '1px solid #334155' }}>Total Amount</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getPurchaseReportData().paginatedList.map(purc => (
                <tr key={purc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a' }}>{purc.invoiceNo}</td>
                  <td style={{ padding: '14px 18px', color: '#475569' }}>{new Date(purc.purchaseDate).toLocaleDateString()}</td>
                  <td style={{ padding: '14px 18px', color: '#334155' }}>{purc.supplier?.name || '-'}</td>
                  <td style={{ padding: '14px 18px' }}><span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '12px' }}>{purc.paymentMode?.name || '-'}</span></td>
                  <td style={{ padding: '14px 18px', fontWeight: 600 }}>{purc.items?.length || 0} Item(s)</td>
                  <td style={{ padding: '14px 18px', fontWeight: 800, color: '#16a34a' }}>₹{purc.totalAmount.toFixed(2)}</td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <button onClick={() => setViewPurchase(purc)} style={{ padding: '6px 12px', borderRadius: '6px', background: '#f1f5f9', border: 'none', color: '#0284c7', marginRight: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Eye size={16} /> View Details
                    </button>
                    <button onClick={() => handleDeleteItem('purchase', purc.id, purc.invoiceNo)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#fff1f2', border: 'none', color: '#e11d48', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No purchase entries found. Click "Purchase Entry" tab to record a new purchase.</td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalPages={getPurchaseReportData().totalPages}
            totalItems={getPurchaseReportData().totalItems}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setPageSize}
          />
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT MASTER ITEM */}
      {/* --------------------------------------------------------- */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '550px', maxWidth: '95%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ background: 'var(--sidebar-active)', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingItem ? 'Edit' : 'Add New'} {modalType.toUpperCase()}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveMaster} style={{ padding: '20px' }}>
              {/* Product Form Fields */}
              {modalType === 'product' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Product Code *</label>
                    <input type="text" readOnly={!editingItem} value={editingItem ? (formData.code || '') : getNextProductCode()} onChange={e => setFormData({ ...formData, code: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: !editingItem ? '#f1f5f9' : 'white', color: !editingItem ? '#1e293b' : '#000', fontWeight: !editingItem ? 700 : 'normal' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Product Name *</label>
                    <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={formData.categoryId || ''}
                      onChange={val => setFormData({ ...formData, categoryId: val })}
                      placeholder="-- Select Category --"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Unit</label>
                    <SearchableSelect
                      options={unitOptions}
                      value={formData.unitId || ''}
                      onChange={val => setFormData({ ...formData, unitId: val })}
                      placeholder="-- Select Unit --"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Price (₹)</label>
                    <input type="number" step="any" value={formData.price || 0} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Status</label>
                    <SearchableSelect
                      options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
                      value={formData.status || 'Active'}
                      onChange={val => setFormData({ ...formData, status: val })}
                    />
                  </div>
                </div>
              )}

              {/* Category Form Fields */}
              {modalType === 'category' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Name *</label>
                    <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                    <textarea rows={3} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                </div>
              )}

              {/* Unit Form Fields */}
              {modalType === 'unit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Unit Name * (e.g. Kilogram, Liter)</label>
                    <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Symbol / Abbreviation (e.g. kg, ltr, pkt)</label>
                    <input type="text" value={formData.symbol || ''} onChange={e => setFormData({ ...formData, symbol: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                </div>
              )}

              {/* Supplier Form Fields */}
              {modalType === 'supplier' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Supplier Name *</label>
                    <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Phone</label>
                    <input type="text" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Email</label>
                    <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>GST Number</label>
                    <input type="text" value={formData.gstNo || ''} onChange={e => setFormData({ ...formData, gstNo: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Address</label>
                    <textarea rows={2} value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                </div>
              )}

              {/* Payment Mode Form Fields */}
              {modalType === 'payment-mode' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Payment Mode Name *</label>
                    <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', background: '#f1f5f9', border: 'none', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: '6px', background: 'var(--sidebar-active)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL: VIEW PURCHASE REPORT DETAILS */}
      {/* --------------------------------------------------------- */}
      {viewPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '650px', maxWidth: '95%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ background: '#10b981', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Purchase Entry Details - {viewPurchase.invoiceNo}</h3>
              <button onClick={() => setViewPurchase(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', padding: '15px', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px' }}>
                <div><strong>Entry #:</strong> {viewPurchase.invoiceNo}</div>
                <div><strong>Date:</strong> {new Date(viewPurchase.purchaseDate).toLocaleDateString()}</div>
                <div><strong>Supplier:</strong> {viewPurchase.supplier?.name || '-'}</div>
                <div><strong>Payment Mode:</strong> {viewPurchase.paymentMode?.name || '-'}</div>
              </div>

              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#334155' }}>Items Breakdown:</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white' }}>
                    <th style={{ padding: '8px 12px' }}>Product</th>
                    <th style={{ padding: '8px 12px' }}>Qty</th>
                    <th style={{ padding: '8px 12px' }}>Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewPurchase.items?.map((it: any) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{it.product?.code ? `[${it.product.code}] ` : ''}{it.productName}</td>
                      <td style={{ padding: '8px 12px' }}>{it.qty} {it.unit || ''}</td>
                      <td style={{ padding: '8px 12px' }}>₹{it.price}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{it.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #e2e8f0', paddingTop: '15px' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>{viewPurchase.notes ? `Notes: ${viewPurchase.notes}` : ''}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>
                  Total: ₹{viewPurchase.totalAmount.toFixed(2)}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setViewPurchase(null)} style={{ padding: '8px 20px', borderRadius: '6px', background: '#334155', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL: VIEW MASTER DETAILS */}
      {/* --------------------------------------------------------- */}
      {viewMasterItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '500px', maxWidth: '95%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ background: '#3B82F6', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{viewMasterType} Details</h3>
              <button onClick={() => setViewMasterItem(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Name</span>
                  <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>{viewMasterItem.name || '-'}</span>
                </div>
                {viewMasterItem.code !== undefined && viewMasterItem.code !== null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Product Code</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>{viewMasterItem.code || '-'}</span>
                  </div>
                )}
                {viewMasterType === 'Product' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Category</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>{viewMasterItem.category?.name || '-'}</span>
                  </div>
                )}
                {viewMasterType === 'Product' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Unit</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>{viewMasterItem.unit?.name || '-'} {viewMasterItem.unit?.symbol ? `(${viewMasterItem.unit.symbol})` : ''}</span>
                  </div>
                )}
                {viewMasterItem.price !== undefined && viewMasterType === 'Product' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Price</span>
                    <span style={{ color: '#16a34a', fontSize: '14px', fontWeight: 800 }}>₹{viewMasterItem.price}</span>
                  </div>
                )}
                {viewMasterType === 'Product' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Status</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, width: 'fit-content', color: viewMasterItem.status === 'Inactive' ? '#EF4444' : '#16A34A', background: viewMasterItem.status === 'Inactive' ? '#FEF2F2' : '#F0FDF4' }}>{viewMasterItem.status || 'Active'}</span>
                  </div>
                )}
                {viewMasterItem.description !== undefined && viewMasterItem.description !== null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Description</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 500 }}>{viewMasterItem.description || '-'}</span>
                  </div>
                )}
                {viewMasterItem.symbol !== undefined && viewMasterItem.symbol !== null && viewMasterType === 'Unit' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Symbol</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>{viewMasterItem.symbol || '-'}</span>
                  </div>
                )}
                {viewMasterItem.phone !== undefined && viewMasterItem.phone !== null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Phone</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 500 }}>{viewMasterItem.phone || '-'}</span>
                  </div>
                )}
                {viewMasterItem.email !== undefined && viewMasterItem.email !== null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Email</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 500 }}>{viewMasterItem.email || '-'}</span>
                  </div>
                )}
                {viewMasterItem.gstNo !== undefined && viewMasterItem.gstNo !== null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>GST Number</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>{viewMasterItem.gstNo || '-'}</span>
                  </div>
                )}
                {viewMasterItem.address !== undefined && viewMasterItem.address !== null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Address</span>
                    <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 500 }}>{viewMasterItem.address || '-'}</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setViewMasterItem(null)} style={{ padding: '8px 20px', borderRadius: '6px', background: '#334155', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
