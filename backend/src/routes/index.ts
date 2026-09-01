import { Router, type IRouter } from "express";
import healthRouter from "./health";
import universitiesRouter from "./universities";
import coursesRouter from "./courses";
import careersRouter from "./careers";
import reviewsRouter from "./reviews";
import storiesRouter from "./stories";
import roadmapsRouter from "./roadmaps";
import aiRouter from "./ai";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import usersRouter from "./users";
import savedRouter from "./saved";
import checkerRouter from "./checker";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(savedRouter);
router.use(universitiesRouter);
router.use(coursesRouter);
router.use(careersRouter);
router.use(reviewsRouter);
router.use(storiesRouter);
router.use(roadmapsRouter);
router.use(aiRouter);
router.use(dashboardRouter);
router.use(checkerRouter);
router.use(adminRouter);

export default router;
