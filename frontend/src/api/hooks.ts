import { useQuery, useMutation } from "@tanstack/react-query"
import { apiGet, apiPost } from "./client"

interface CountItem { nicho: string; regiao: string; count: number }
interface Task { id: string; name: string; nicho: string; regiao: string; oferta: string | null; fonte: string | null; copywriter: string | null; editor: string | null; mes: string | null; date_created: number }
interface TaskDetail extends Task { description: string; status: string; checklists: { name: string; items: { name: string; resolved: boolean }[] }[] }

export function useCounts() {
  return useQuery<CountItem[]>({ queryKey: ["counts"], queryFn: () => apiGet<CountItem[]>("/api/atribuidor/counts") })
}

export function useTasks(nicho?: string | null, regiao?: string | null) {
  return useQuery<Task[]>({
    queryKey: ["tasks", nicho, regiao],
    queryFn: () => apiGet<Task[]>("/api/atribuidor/tasks", { nicho: nicho!, regiao: regiao! }),
    enabled: !!nicho && !!regiao,
  })
}

export function useTaskDetail(id?: string | null) {
  return useQuery<TaskDetail>({
    queryKey: ["task", id],
    queryFn: () => apiGet<TaskDetail>(`/api/atribuidor/tasks/${id}`),
    enabled: !!id,
  })
}

export function useClaim() {
  return useMutation({
    mutationFn: ({ taskId, gestorNome }: { taskId: string; gestorNome?: string }) =>
      apiPost(`/api/atribuidor/tasks/${taskId}/claim`, { gestor_nome: gestorNome }),
  })
}
