import { ActivepiecesError, ErrorCode, isNil, SeekPage } from '@activepieces/core-utils'
import { ListTemplatesRequestQuery, Template } from '@activepieces/shared'
import { z } from 'zod'

const TEMPLATES_SOURCE_URL = 'https://cloud.activepieces.com/api/v1/templates'
const remoteTemplate = z.preprocess(value => {
    if (typeof value !== 'object' || value === null) return value
    return { ...value, ...('flows' in value && value.flows === null ? { flows: undefined } : {}), ...('tables' in value && value.tables === null ? { tables: undefined } : {}) }
}, Template)

export const communityTemplates = {
    getOrThrow: async (id: string): Promise<Template> => {
        const url = `${TEMPLATES_SOURCE_URL}/${id}`
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        if (!response.ok) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'template',
                    entityId: id,
                    message: `Template ${id} not found`,
                },
            })
        }
        const template = remoteTemplate.parse(await response.json())
        return template
    },
    getCategories: async (): Promise<string[]> => {
        const url = `${TEMPLATES_SOURCE_URL}/categories`
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const categories = z.array(z.string()).parse(await response.json())
        return categories
    },
    list: async (request: ListTemplatesRequestQuery): Promise<SeekPage<Template>> => {
        const queryString = convertToQueryString(request)
        const url = `${TEMPLATES_SOURCE_URL}?${queryString}`
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const templates = z.object({ data: z.array(remoteTemplate), next: z.string().nullable(), previous: z.string().nullable() }).parse(await response.json())
        return templates
    },
}


function convertToQueryString(params: ListTemplatesRequestQuery): string {
    const searchParams = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((val) => {
                if (!isNil(val)) {
                    searchParams.append(key, typeof val === 'string' ? val : JSON.stringify(val))
                }
            })
        }
        else if (!isNil(value)) {
            searchParams.set(key, value.toString())
        }
    })

    return searchParams.toString()
}
