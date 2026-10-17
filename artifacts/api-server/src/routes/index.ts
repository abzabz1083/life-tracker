import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lifeRouter from "./life";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lifeRouter);

export default router;
