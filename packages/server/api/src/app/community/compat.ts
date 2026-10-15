import { ActivepiecesError, ErrorCode, Permission, RoleType } from '@activepieces/core-utils'
import { PieceMetadataModel, PieceMetadataModelSummary } from '@activepieces/pieces-framework'
import { DefaultProjectRole, EmbedSubdomain, OPEN_SOURCE_PLAN, PlatformPlan, PlatformRole, PlatformUsage, PlatformWithoutSensitiveData, PopulatedTable, Principal, PrincipalType, ProjectMemberWithUser, ProjectRole, rolePermissions, TableState } from '@activepieces/shared'
import { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify'
import { EntitySchema } from 'typeorm'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'

async function unavailable(..._arguments: unknown[]): Promise<never> {
    throw new ActivepiecesError({ code: ErrorCode.FEATURE_DISABLED, params: { message: 'This feature is unavailable in Community Edition' } })
}

async function assertProjectAccess({ principal, projectId, log }: { principal: Principal, projectId: string, log: FastifyBaseLogger }): Promise<void> {
    const project = await projectService(log).getOneOrThrow(projectId)
    if (principal.type === PrincipalType.ENGINE && principal.projectId === project.id && principal.platform.id === project.platformId) return
    if (principal.type === PrincipalType.USER) {
        const user = await userService(log).getOneOrFail({ id: principal.id })
        if (user.platformId === project.platformId && (project.ownerId === user.id || user.platformRole === PlatformRole.ADMIN)) return
    }
    throw new ActivepiecesError({ code: ErrorCode.AUTHORIZATION, params: { message: 'Access to this project is denied' } })
}

async function getRole({ userId, projectId, log }: { userId: string, projectId: string, log: FastifyBaseLogger }): Promise<ProjectRole> {
    const user = await userService(log).getOneOrFail({ id: userId })
    if (!user.platformId) throw new ActivepiecesError({ code: ErrorCode.AUTHORIZATION, params: {} })
    await assertProjectAccess({ principal: { id: userId, type: PrincipalType.USER, platform: { id: user.platformId } }, projectId, log })
    return ProjectRole.parse({ id: 'community-owner', name: DefaultProjectRole.ADMIN, type: RoleType.DEFAULT, permissions: rolePermissions[DefaultProjectRole.ADMIN], created: new Date().toISOString(), updated: new Date().toISOString(), platformId: user.platformId })
}

function communityPlan({ platformId }: { platformId: string }): PlatformPlan {
    return { ...OPEN_SOURCE_PLAN, id: platformId, platformId, created: new Date().toISOString(), updated: new Date().toISOString() }
}

export const platformPlanService = (_log: FastifyBaseLogger) => ({
    getOrCreateForPlatform: async (platformId: string) => communityPlan({ platformId }),
    onPlatformCreated: async (platformId: string) => communityPlan({ platformId }),
    checkUsersExceededLimit: async (..._arguments: unknown[]) => undefined,
    checkActiveFlowsExceededLimit: async (..._arguments: unknown[]) => undefined,
    update: unavailable,
    getUsage: async (_platformId: string): Promise<PlatformUsage> => ({ creditsUsed: 0, creditsRemaining: null, creditsNextResetAt: null, appSumoAiCreditsUsed: null, appSumoAiCreditsRemaining: null, activeFlows: 0, teamProjects: 0, users: 1, activeUsers: 1, invitedSeats: 0 }),
})

export const rbacService = (log: FastifyBaseLogger) => ({
    assertPrinicpalAccessToProject: async ({ principal, projectId }: { principal: Principal, projectId: string, permission?: Permission }) => assertProjectAccess({ principal, projectId, log }),
})

export const projectMemberService = (log: FastifyBaseLogger) => ({
    getRole: async ({ userId, projectId }: { userId: string, projectId: string }) => getRole({ userId, projectId, log }),
    hasPermissionOnAnyProject: async ({ userId, platformId }: { userId: string, platformId: string, permission: Permission }) => (await projectService(log).getAllForUser({ userId, platformId, isPrivileged: false })).length > 0,
    listProjectIdsWithPermission: async ({ userId, platformId }: { userId: string, platformId: string, permission: Permission }) => (await projectService(log).getAllForUser({ userId, platformId, isPrivileged: false })).map(project => project.id),
    list: async (..._arguments: unknown[]): Promise<{ data: ProjectMemberWithUser[] }> => ({ data: [] }),
    upsert: unavailable,
})

export const getPrincipalRoleOrThrow = (userId: string, projectId: string, log: FastifyBaseLogger) => getRole({ userId, projectId, log })
export const editionRequiresRbac = () => false
export const assertUserHasPermissionToFlow = async (principal: Principal, projectId: string, _operation: unknown, log: FastifyBaseLogger) => assertProjectAccess({ principal, projectId, log })
export const assertRoleHasPermission = unavailable
export const projectRoleService = { getOneOrThrow: (..._arguments: unknown[]): Promise<ProjectRole> => unavailable(), getOneOrThrowById: (..._arguments: unknown[]): Promise<ProjectRole> => unavailable() }
export const projectMemberRepo = () => ({ find: async (..._arguments: unknown[]): Promise<{ userId: string }[]> => [] })
export const projectLimitsService = (_log: FastifyBaseLogger) => ({ checkActiveFlowsExceededLimit: async (..._arguments: unknown[]) => undefined })
export const platformProjectService = (_log: FastifyBaseLogger) => ({ deletePersonalProjectForUser: unavailable })
export const platformMustHaveFeatureEnabled = (_predicate: (platform: PlatformWithoutSensitiveData) => boolean) => unavailable
export const projectMustBeTeamType = unavailable

export async function platformMustBeOwnedByCurrentUser(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (request.principal.type !== PrincipalType.USER) return unavailable()
    const user = await userService(request.log).getOneOrFail({ id: request.principal.id })
    if (user.platformId !== request.principal.platform.id || user.platformRole !== PlatformRole.ADMIN) return unavailable()
}

export const platformToEditMustBeOwnedByCurrentUser = platformMustBeOwnedByCurrentUser
export const apiKeyService = { getByValue: async (_value: string): Promise<{ id: string, platformId: string } | null> => null }
export const workerGroupService = (_log: FastifyBaseLogger) => ({ isCanaryPlatform: async (..._arguments: unknown[]) => false, isWorkerGroupsEnabled: async (..._arguments: unknown[]) => false, getWorkerGroupId: async (..._arguments: unknown[]): Promise<string | null> => null, getWorkerGroupPlatformId: async (..._arguments: unknown[]): Promise<string | null> => null })
export const concurrencyPoolService = (_log: FastifyBaseLogger) => ({ getPoolLimit: async (..._arguments: unknown[]): Promise<number | null> => null, getProjectPoolId: async (..._arguments: unknown[]): Promise<string | null> => null })
export const gitRepoService = (_log: FastifyBaseLogger) => ({ onDeleted: async (..._arguments: unknown[]) => undefined })
export const containsSecretManagerReference = (_value: unknown) => false
export const secretManagersService = (_log: FastifyBaseLogger) => ({
    resolveObject: async <T>({ value }: { value: T, platformId: string, projectIds?: string[], throwOnFailure?: boolean }) => value,
    resolveString: async ({ key }: { key: string, platformId: string, projectIds?: string[], throwOnFailure?: boolean }) => key,
})
export const smtpEmailSender = (_log: FastifyBaseLogger) => ({ isSmtpConfigured: () => false })
export const emailService = (log: FastifyBaseLogger) => ({ sendOtp: async (details: unknown) => {
    log.info({ details }, 'Local development email')
}, sendPlatformDeleted: async (..._arguments: unknown[]) => undefined, sendProjectMemberAdded: unavailable, sendInvitation: unavailable })
export const federatedAuthnService = (_log: FastifyBaseLogger) => ({ getThirdPartyRedirectUrl: async () => null })
export const invalidateSamlClientCache = (_platformId: string) => undefined
export const openRouterApi = { createKey: async (..._arguments: unknown[]): Promise<{ key: string, data: { hash: string } }> => unavailable(), deleteKey: unavailable }
export const alertsService = (_log: FastifyBaseLogger) => ({ sendAlertOnRunFinish: async (..._arguments: unknown[]) => undefined })
export const agentRetention = (_log: FastifyBaseLogger) => ({ deleteStaleFlowStepConversations: async () => undefined })
export const chatVisibilityHelper = { resolveChatEnabledForUser: (..._arguments: unknown[]) => false }
export const beginPlatformTeardown = unavailable
export const embedSubdomainService = (_log: FastifyBaseLogger) => ({ getByHostname: async (..._arguments: unknown[]): Promise<EmbedSubdomain | null> => null })
export const platformTemplateService = () => ({ create: unavailable, update: unavailable })
export const projectStateService = (_log: FastifyBaseLogger) => ({ getTableState: (table: PopulatedTable): TableState => TableState.parse({ ...table, fields: table.fields.map(field => ({ ...field, data: 'data' in field ? field.data : null })) }) })
export const AuditEventEntity = new EntitySchema<{ id: string, data: unknown }>({ name: 'audit_event_unavailable', columns: { id: { type: String, primary: true } } })
export const agentRpcHandlers = (_log: FastifyBaseLogger) => ({ getAgentConfig: unavailable, saveAgentMessages: unavailable, saveAgentFile: unavailable, readAgentFile: unavailable, updateAgentProgress: unavailable, heartbeatAgentConversation: unavailable, agentCreditsLeft: unavailable, updateProjectContext: unavailable, executeAgentTool: unavailable, executePieceTool: unavailable, executeKnowledgeBaseTool: unavailable, executeFlowTool: unavailable, updateFlowStepProgress: unavailable, resumeFlowStep: unavailable, sendAgentEmail: unavailable })
export const chatPersonalizationService = (_log: FastifyBaseLogger) => ({ getConfigForWorker: unavailable, getPrefillConfigForWorker: unavailable, saveResult: unavailable, savePrefill: unavailable, sendProgress: unavailable })
export const resolveVisibility = async (..._arguments: unknown[]): Promise<VisibilityPolicy | null> => null

type VisibilityPolicy = {
    isPieceVisible: (name: string) => boolean
    filterPieces: <T>(pieces: T[]) => T[]
    filterComponents: (pieces: PieceMetadataModelSummary[]) => PieceMetadataModelSummary[]
    filterPieceComponents: (piece: PieceMetadataModel) => PieceMetadataModel
}
