import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { 
    getCloudAlertsForUser, 
    createCloudAlert, 
    isBelowMaxCloudAlerts,
    MAX_CLOUD_ALERTS,
    MAX_NAME_LENGTH
} from '$lib/api/backend/cloud-alerts';

export const GET: RequestHandler = async ({ locals, platform }) => {
    if (!platform?.env?.DB) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const alerts = await getCloudAlertsForUser(platform.env.DB, locals.user.id.toString());
        return json(alerts);
    } catch (error) {
        console.error('Error fetching cloud alerts:', error);
        return json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
    if (!platform?.env?.DB) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const data = await request.json();
        
        // Validate required fields
        if (!data.name || typeof data.name !== 'string') {
            return json({ error: 'Alert name is required' }, { status: 400 });
        }
        
        if (!Array.isArray(data.serverTypeIds) || data.serverTypeIds.length === 0) {
            return json({ error: 'At least one server type must be selected' }, { status: 400 });
        }
        
        if (!Array.isArray(data.locationIds) || data.locationIds.length === 0) {
            return json({ error: 'At least one location must be selected' }, { status: 400 });
        }
        
        if (!['available', 'unavailable', 'both'].includes(data.alertOn)) {
            return json({ error: 'Invalid alert type' }, { status: 400 });
        }

        // Check alert limit
        const canCreateAlert = await isBelowMaxCloudAlerts(platform.env.DB, locals.user.id.toString());
        if (!canCreateAlert) {
            return json({ 
                error: `You have reached the maximum of ${MAX_CLOUD_ALERTS} cloud alerts` 
            }, { status: 400 });
        }

        // Validate name length
        if (data.name.length > MAX_NAME_LENGTH) {
            return json({ 
                error: `Alert name must be ${MAX_NAME_LENGTH} characters or less` 
            }, { status: 400 });
        }

        // Validate server type IDs and location IDs are numbers
        if (!data.serverTypeIds.every((id: any) => typeof id === 'number')) {
            return json({ error: 'Invalid server type IDs' }, { status: 400 });
        }
        
        if (!data.locationIds.every((id: any) => typeof id === 'number')) {
            return json({ error: 'Invalid location IDs' }, { status: 400 });
        }

        // Create the alert
        const alertId = await createCloudAlert(
            platform.env.DB,
            locals.user.id.toString(),
            data.name,
            data.serverTypeIds,
            data.locationIds,
            data.alertOn,
            data.emailNotifications ?? true,
            data.discordNotifications ?? false
        );

        return json({ success: true, alertId });
    } catch (error) {
        console.error('Error creating cloud alert:', error);
        return json({ error: 'Failed to create alert' }, { status: 500 });
    }
};