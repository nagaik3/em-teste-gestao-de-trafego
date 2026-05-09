import { useQuery, useMutation } from "@tanstack/react-query"
import { apiGet, apiPost } from "./client"

// Types
interface CountItem { nicho: string; regiao: string; count: number }
interface Task { id: string; name: string; nicho: string; regiao: string; oferta: string | null; fonte: string | null; copywriter: string | null; editor: string | null; mes: string | null; date_created: number }
interface TaskDetail extends Task { description: string; status: string; checklists: { name: string; items: { name: string; resolved: boolean }[] }[] }

// Atribuidor
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
    mutationFn: ({ taskId, gestorNome }: { taskId: string; gestorNome: string }) =>
      apiPost(`/api/atribuidor/tasks/${taskId}/claim`, { gestor_nome: gestorNome }),
  })
}

// Gestao
interface GestaoResponse { groups: { status: string; count: number; tasks: any[] }[] }
interface CreativeResponse { task: any; creatives: any[]; total: number; moved: number }

export function useGestaoTasks(gestorKey: string | null) {
  return useQuery<GestaoResponse>({
    queryKey: ["gestao-tasks", gestorKey],
    queryFn: () => apiGet<GestaoResponse>("/api/gestao/tasks", { gestor: gestorKey! }),
    enabled: !!gestorKey,
  })
}

export function useTaskCreatives(taskId: string | null, gestorKey: string | null) {
  return useQuery<CreativeResponse>({
    queryKey: ["task-creatives", taskId, gestorKey],
    queryFn: () => apiGet<CreativeResponse>(`/api/gestao/tasks/${taskId}/creatives`, { gestor: gestorKey! }),
    enabled: !!taskId && !!gestorKey,
  })
}

export function useMoveCreative() {
  return useMutation({
    mutationFn: ({ taskId, creativeCode, destinationStatus, gestorNome }: {
      taskId: string; creativeCode: string; destinationStatus: string; gestorNome: string
    }) => apiPost(`/api/gestao/tasks/${taskId}/move-creative`, {
      creative_code: creativeCode, destination_status: destinationStatus, gestor_nome: gestorNome,
    }),
  })
}

// Nova Tarefa
interface FormOptions { nichos: any[]; regioes: any[]; fontes: any[]; ofertas: any[]; gestores: any[] }

export function useFormOptions() {
  return useQuery<FormOptions>({
    queryKey: ["form-options"],
    queryFn: () => apiGet<FormOptions>("/api/nova-tarefa/options"),
  })
}

export function useCreateTask() {
  return useMutation({
    mutationFn: (data: { nicho: string; regiao: string; oferta: string; fonte: string; creative_name: string; material_link: string; gestor_key: string }) =>
      apiPost("/api/nova-tarefa/create", data as any),
  })
}
