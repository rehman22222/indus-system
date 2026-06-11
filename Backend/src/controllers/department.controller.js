import { Department } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize, serializeMany } from '../utils/mongo.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';

export const getDepartments = async (req, res) => {
    const { active = 'true' } = req.query;
    const filter = {};

    if (active !== 'false') {
        filter.is_active = true;
    }

    const key = cacheKey('departments:list', req.query);
    const departments = await getOrSetCache(key, 300, async () => (
        Department.find(filter)
            .sort({ name: 1 })
            .maxTimeMS(5000)
            .lean({ virtuals: true })
    ));
    const data = serializeMany(departments);
    res.status(200).json({ departments: data, data });
};

export const getDepartmentById = async (req, res) => {
    const id = requireObjectId(req.params.id, 'departmentId');
    const key = cacheKey('departments:detail', { id: id.toString() });
    const department = await getOrSetCache(key, 300, async () => (
        Department.findById(id).maxTimeMS(5000).lean({ virtuals: true })
    ));

    if (!department) {
        throw new AppError('Department not found', 404);
    }

    const data = serialize(department);
    res.status(200).json({ department: data, data });
};

export const createDepartment = async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) {
        throw new AppError('Department name is required', 400);
    }

    const department = await Department.create({
        name,
        description: req.body.description,
        capacity: req.body.capacity,
        floor_number: req.body.floor_number || req.body.floorNumber,
        contact_email: req.body.contact_email || req.body.contactEmail,
        contact_phone: req.body.contact_phone || req.body.contactPhone,
        is_active: req.body.is_active ?? true,
    });

    await invalidateCache(['departments:*', 'doctors:*', 'dashboard:*']);

    res.status(201).json({
        message: 'Department created successfully',
        department: serialize(department),
        data: serialize(department),
    });
};
