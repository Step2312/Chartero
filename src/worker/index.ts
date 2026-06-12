import { getAllImages, processPDF, pdfjsLib } from './pdf';
import { WorkerManagerBase, WorkerRequest, WorkerResponse } from './manager';

class WorkerSlave extends WorkerManagerBase<DedicatedWorkerGlobalScope> {
    protected async onRequest(request: WorkerRequest<DedicatedWorkerGlobalScope>) {
        try {
            const [result, transfer] = await process(request.method, request.params),
                response: WorkerResponse = { id: request.id, result };
            postMessage({ response }, transfer);
        } catch (error) {
            const response: WorkerResponse = {
                id: request.id,
                error: serializeError(error),
            };
            postMessage({ response });
        }
    }
}
export const manager = new WorkerSlave(self);

function serializeError(error: unknown): WorkerResponse['error'] {
    if (error instanceof Error)
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
        };
    return { message: String(error) };
}

async function process(method: string, params?: any[]): Promise<[any, any[]]> {
    switch (method) {
        case 'processPDF':
            return [await processPDF(params![0]), []];

        case 'getAllImages':
            return [await getAllImages(params![0]), []];

        case 'close':
            pdfjsLib.GlobalWorkerOptions.workerPort?.terminate();
            return ['OK', []];

        default:
            console.log('Unknown method:', method);
            return [null, []];
    }
}
