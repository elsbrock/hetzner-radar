import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { 
    getCloudAlertById,
    updateCloudAlert,
    deleteCloudAlert,
    MAX_NAME_LENGTH
} from '$lib/api/backend/cloud-alerts';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
    if (!platform?.env?.DB) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const alert = await getCloudAlertById(platform.env.DB, locals.user.id, params.alertId);
        
        if (!alert) {
            return json({ error: 'Alert not found' }, { status: 404 });
        }

        return json(alert);
    } catch (error) {
        console.error('Error fetching cloud alert:', error);
        return json({ error: 'Failed to fetch alert' }, { status: 500 });
    }
};

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
    if (!platform?.env?.DB) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Verify alert exists and belongs to user
        const existingAlert = await getCloudAlertById(platform.env.DB, locals.user.id, params.alertId);
        if (!existingAlert) {
            return json({ error: 'Alert not found' }, { status: 404 });
        }

        const updates = await request.json();
        const validUpdates: Parameters<typeof updateCloudAlert>[3] = {};

        // Validate and prepare updates
        if (updates.name !== undefined) {
            if (typeof updates.name !== 'string' || updates.name.length === 0) {
                return json({ error: 'Invalid alert name' }, { status: 400 });
            }
            if (updates.name.length > MAX_NAME_LENGTH) {
                return json({ 
                    error: `Alert name must be ${MAX_NAME_LENGTH} characters or less` 
                }, { status: 400 });
            }
            validUpdates.name = updates.name;
        }

        if (updates.serverTypeIds !== undefined) {
            if (!Array.isArray(updates.serverTypeIds) || updates.serverTypeIds.length === 0) {
                return json({ error: 'At least one server type must be selected' }, { status: 400 });
            }
            if (!updates.serverTypeIds.every((id: any) => typeof id === 'number')) {
                return json({ error: 'Invalid server type IDs' }, { status: 400 });
            }
            validUpdates.serverTypeIds = updates.serverTypeIds;
        }

        if (updates.locationIds !== undefined) {
            if (!Array.isArray(updates.locationIds) || updates.locationIds.length === 0) {
                return json({ error: 'At least one location must be selected' }, { status: 400 });
            }
            if (!updates.locationIds.every((id: any) => typeof id === 'number')) {
                return json({ error: 'Invalid location IDs' }, { status: 400 });
            }
            validUpdates.locationIds = updates.locationIds;
        }

        if (updates.alertOn !== undefined) {
            if (!['available', 'unavailable', 'both'].includes(updates.alertOn)) {
                return json({ error: 'Invalid alert type' }, { status: 400 });
            }
            validUpdates.alertOn = updates.alertOn;
        }

        if (updates.emailNotifications !== undefined) {
            validUpdates.emailNotifications = Boolean(updates.emailNotifications);
        }

        if (updates.discordNotifications !== undefined) {
            validUpdates.discordNotifications = Boolean(updates.discordNotifications);
        }

        await updateCloudAlert(platform.env.DB, locals.user.id, params.alertId, validUpdates);

        return json({ success: true });
    } catch (error) {
        console.error('Error updating cloud alert:', error);
        return json({ error: 'Failed to update alert' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
    if (!platform?.env?.DB) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Verify alert exists and belongs to user
        const existingAlert = await getCloudAlertById(platform.env.DB, locals.user.id, params.alertId);
        if (!existingAlert) {
            return json({ error: 'Alert not found' }, { status: 404 });
        }

        await deleteCloudAlert(platform.env.DB, locals.user.id, params.alertId);

        return json({ success: true });
    } catch (error) {
        console.error('Error deleting cloud alert:', error);
        return json({ error: 'Failed to delete alert' }, { status: 500 });
    }
};