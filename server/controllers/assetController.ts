import { Request, Response } from 'express';
import {
  getItAssets,
  createItAsset,
  updateItAsset,
  deleteItAsset,
  getSoftwareLicenses,
  createSoftwareLicense,
  deleteSoftwareLicense,
} from '../db/database';
import { logActivity } from '../middleware/auditLogger';

export async function listHardwareAssets(req: Request, res: Response) {
  try {
    const assets = getItAssets();
    res.json({ success: true, assets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createHardwareAsset(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { assetTag, assetName, category, serialNumber, assignedToUserId, status, purchaseDate, specsInfo, notes } = req.body;

    if (!assetTag || !assetName || !category) {
      return res.status(400).json({ error: 'Mã tài sản, tên thiết bị và danh mục là bắt buộc' });
    }

    const assetId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    createItAsset(
      assetId,
      assetTag.trim().toUpperCase(),
      assetName.trim(),
      category,
      serialNumber || null,
      assignedToUserId || null,
      status || 'AVAILABLE',
      purchaseDate || null,
      specsInfo || null,
      notes || null
    );

    logActivity(
      { id: user.id, username: user.username, role: user.role },
      'IT_ASSET_CREATED',
      { assetId, assetTag, assetName, category }
    );

    res.status(201).json({
      success: true,
      message: 'Đã thêm thiết bị vào kho tài sản IT thành công',
      assetId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateHardwareAsset(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { assetName, category, serialNumber, assignedToUserId, status, specsInfo, notes } = req.body;

    updateItAsset(
      id,
      assetName,
      category,
      serialNumber || null,
      assignedToUserId || null,
      status,
      specsInfo || null,
      notes || null
    );

    logActivity(
      { id: user.id, username: user.username, role: user.role },
      'IT_ASSET_UPDATED',
      { id, assetName, status, assignedToUserId }
    );

    res.json({ success: true, message: 'Đã cập nhật thông tin thiết bị thành công' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function removeHardwareAsset(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    deleteItAsset(id);
    logActivity(
      { id: user.id, username: user.username, role: user.role },
      'IT_ASSET_DELETED',
      { id }
    );

    res.json({ success: true, message: 'Đã xóa thiết bị khỏi hệ thống' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listLicenses(req: Request, res: Response) {
  try {
    const licenses = getSoftwareLicenses();
    res.json({ success: true, licenses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createLicense(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { softwareName, licenseType, licenseKey, totalSeats, assignedSeats, expiryDate, notes } = req.body;

    if (!softwareName || !licenseKey) {
      return res.status(400).json({ error: 'Tên phần mềm và khóa bản quyền là bắt buộc' });
    }

    const licenseId = `lic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    createSoftwareLicense(
      licenseId,
      softwareName,
      licenseType || 'PER_SEAT',
      licenseKey,
      Number(totalSeats) || 1,
      Number(assignedSeats) || 0,
      expiryDate || null,
      notes || null
    );

    logActivity(
      { id: user.id, username: user.username, role: user.role },
      'SOFTWARE_LICENSE_ADDED',
      { licenseId, softwareName }
    );

    res.status(201).json({
      success: true,
      message: 'Đã thêm bản quyền phần mềm thành công',
      licenseId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function removeLicense(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    deleteSoftwareLicense(id);
    logActivity(
      { id: user.id, username: user.username, role: user.role },
      'SOFTWARE_LICENSE_DELETED',
      { id }
    );

    res.json({ success: true, message: 'Đã xóa bản quyền phần mềm' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function exportAssetInventoryCsv(req: Request, res: Response) {
  try {
    const assets = getItAssets();

    const headers = [
      'Mã Tài Sản',
      'Tên Thiết Bị',
      'Phân Loại',
      'Số Serial',
      'Trạng Thái',
      'Người Nắm Giữ',
      'Tài Khoản',
      'Thông Số Kỹ Thuật',
      'Ngày Mua',
      'Ghi Chú',
    ];

    const rows = assets.map((a) => {
      const statusVi =
        a.status === 'IN_USE'
          ? 'Đang Cấp Phát'
          : a.status === 'AVAILABLE'
          ? 'Sẵn Sàng Trong Kho'
          : a.status === 'MAINTENANCE'
          ? 'Bảo Hành / Sửa Chữa'
          : 'Thanh Lý';

      return [
        `"${a.asset_tag || ''}"`,
        `"${(a.asset_name || '').replace(/"/g, '""')}"`,
        `"${a.category || ''}"`,
        `"${a.serial_number || ''}"`,
        `"${statusVi}"`,
        `"${a.assigned_user_name || 'Chưa cấp phát'}"`,
        `"${a.assigned_username || ''}"`,
        `"${(a.specs_info || '').replace(/"/g, '""')}"`,
        `"${a.purchase_date || ''}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="IT_Asset_Inventory_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(Buffer.from(csvContent, 'utf-8'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

