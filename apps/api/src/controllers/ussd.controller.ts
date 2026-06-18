import { Request, Response } from 'express';
import * as ussdService from '../services/ussd.service';

export async function ussdSessionController(req: Request, res: Response): Promise<void> {
  const result = await ussdService.handleUssdRequest(req.body);
    res.type('text/plain').status(200).send(result.response);
}
