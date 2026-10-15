import { ActivepiecesError, ErrorCode } from '@activepieces/core-utils'
import { FlowStatus, PiecesFilterType, PrincipalType, Project, ProjectWithLimits } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { flowRepo } from '../flows/flow/flow.repo'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'

function populate({ project, analytics }: { project: Project, analytics: ProjectAnalytics | undefined }): ProjectWithLimits {
    const now = new Date().toISOString()
    return ProjectWithLimits.parse({ ...project, plan: { id: project.id, projectId: project.id, created: now, updated: now, locked: false, name: 'Community', piecesFilterType: PiecesFilterType.NONE, pieces: [], activeFlowsLimit: null }, analytics: { totalUsers: 1, activeUsers: 1, totalFlows: Number(analytics?.totalFlows ?? 0), activeFlows: Number(analytics?.activeFlows ?? 0), lastFlowUpdated: analytics?.lastFlowUpdated ?? null } })
}

async function getAnalytics({ projects }: { projects: Project[] }): Promise<Map<string, ProjectAnalytics>> {
    if (projects.length === 0) return new Map()
    const rows = await flowRepo().createQueryBuilder('flow')
        .select('flow.projectId', 'projectId')
        .addSelect('COUNT(*)', 'totalFlows')
        .addSelect('COUNT(*) FILTER (WHERE flow.status = :enabled)', 'activeFlows')
        .addSelect('MAX(flow.updated)', 'lastFlowUpdated')
        .where('flow.projectId IN (:...projectIds)', { projectIds: projects.map(project => project.id), enabled: FlowStatus.ENABLED })
        .groupBy('flow.projectId')
        .getRawMany<ProjectAnalytics>()
    return new Map(rows.map(row => [row.projectId, row]))
}

export const platformProjectModule: FastifyPluginAsyncZod = async (app) => {
    app.get('/v1/projects', { config: { security: securityAccess.publicPlatform([PrincipalType.USER]) } }, async request => {
        const user = await userService(request.log).getOneOrFail({ id: request.principal.id })
        const projects = await projectService(request.log).getAllForUser({ platformId: request.principal.platform.id, userId: user.id, isPrivileged: userService(request.log).isUserPrivileged(user) })
        const analytics = await getAnalytics({ projects })
        return { data: projects.map(project => populate({ project, analytics: analytics.get(project.id) })), next: null, previous: null }
    })
    app.get('/v1/projects/:id', { config: { security: securityAccess.publicPlatform([PrincipalType.USER]) }, schema: { params: z.object({ id: z.string() }) } }, async request => {
        const project = await projectService(request.log).getOneOrThrow(request.params.id)
        const user = await userService(request.log).getOneOrFail({ id: request.principal.id })
        if (project.platformId !== request.principal.platform.id || (project.ownerId !== user.id && !userService(request.log).isUserPrivileged(user))) throw new ActivepiecesError({ code: ErrorCode.AUTHORIZATION, params: {} })
        const analytics = await getAnalytics({ projects: [project] })
        return populate({ project, analytics: analytics.get(project.id) })
    })
}

type ProjectAnalytics = { projectId: string, totalFlows: string, activeFlows: string, lastFlowUpdated: string | null }
