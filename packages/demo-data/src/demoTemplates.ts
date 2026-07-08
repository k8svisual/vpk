import type { RawObject } from '@vpk/core';
import CSIDriver from './templates/CSIDriver.json';
import CSINode from './templates/CSINode.json';
import ClusterRole from './templates/ClusterRole.json';
import ClusterRoleBinding from './templates/ClusterRoleBinding.json';
import ConfigMap from './templates/ConfigMap.json';
import CronJob from './templates/CronJob.json';
import DaemonSet from './templates/DaemonSet.json';
import Deployment from './templates/Deployment.json';
import Endpoints from './templates/Endpoints.json';
import Event from './templates/Event.json';
import Gateway from './templates/Gateway.json';
import GatewayClass from './templates/GatewayClass.json';
import HTTPRoute from './templates/HTTPRoute.json';
import Job from './templates/Job.json';
import LimitRange from './templates/LimitRange.json';
import Namespace from './templates/Namespace.json';
import NetworkPolicy from './templates/NetworkPolicy.json';
import Node from './templates/Node.json';
import PersistentVolume from './templates/PersistentVolume.json';
import PersistentVolumeClaim from './templates/PersistentVolumeClaim.json';
import Pod from './templates/Pod.json';
import ReplicaSet from './templates/ReplicaSet.json';
import ResourceQuota from './templates/ResourceQuota.json';
import Role from './templates/Role.json';
import RoleBinding from './templates/RoleBinding.json';
import Secret from './templates/Secret.json';
import Service from './templates/Service.json';
import ServiceAccount from './templates/ServiceAccount.json';
import StatefulSet from './templates/StatefulSet.json';
import StorageClass from './templates/StorageClass.json';
import VolumeAttachment from './templates/VolumeAttachment.json';

/**
 * Demo/test-data templates — one representative raw object per Kind, each its own file under `./templates/`
 * (plain JSON, not TypeScript) — a template gets hand-edited far more often than this loader does, and a
 * 2,800-line TS object literal is a bad place for that: no diff locality, one stray comma breaks every other
 * template, and it rules out a future "edit this template" UI ever writing to it directly. One file per Kind
 * means editing/adding/removing a template touches exactly one small, self-contained file.
 *
 * Lives in its own package (not @vpk/core) since this is test-data tooling, not domain logic every view
 * depends on — @vpk/server is the only consumer so far (see its `/demo/templates` endpoint), used by the
 * "Demo Data" screen (App.tsx).
 *
 * Most templates were extracted from a real cluster capture (the "kitchen-sink-demo" snapshot used throughout
 * this app's manual testing) and stripped of instance-identity fields — curated to the ~32 Kinds VpK's
 * Wheel/Schematic/Field views actually recognize (kindColors.ts/kindIcons.ts/wheel.ts/schematic.ts/
 * controlPlane.ts/scene.ts) that were ALSO present in that snapshot.
 *
 * A few recognized Kinds aren't in any snapshot capture yet and were hand-authored instead, straight from the
 * official Gateway API docs (gateway-api.sigs.k8s.io) rather than guessed: GatewayClass, Gateway, HTTPRoute.
 * EndpointSlice, Ingress, ReplicationController still have no template — add one (a new `./templates/X.json`
 * plus an import+entry below) when needed.
 *
 * Intended as the seed data for the "Demo data" generator (see @vpk/demo-data's placeholders.ts): clone a
 * template, substitute its `{{...}}` placeholders (see `extractPlaceholders`/`fillTemplate`), and inject the
 * result into a snapshot to synthesize test data at scale. Substitution is a plain whole-JSON text replace, so
 * a placeholder can appear anywhere — including as an object KEY, which is how Node's role label works.
 *
 * Placeholder convention: `{{name}}` / `{{namespace}}` replace metadata.name/namespace on every template;
 * `{{nodeName}}` replaces Pod's spec.nodeName; `{{gatewayName}}` replaces HTTPRoute's parentRefs[].name;
 * `{{serviceName}}` replaces HTTPRoute's backendRefs[].name. Node is the one template parameterized well
 * beyond identity fields — `{{role}}` (fills the `node-role.kubernetes.io/{{role}}` label KEY, so exactly one
 * role label exists post-fill, unlike the single real master node this was extracted from, which had both),
 * `{{internalIP}}`, `{{cpuCapacity}}`/`{{cpuAllocatable}}`, `{{memCapacityKi}}`/`{{memAllocatableKi}}`,
 * `{{podCapacity}}`/`{{podAllocatable}}`, `{{ephemeralStorageCapacity}}`/`{{ephemeralStorageAllocatable}}`,
 * `{{machineID}}`/`{{systemUUID}}`/`{{bootID}}`. A generator is expected to substitute every placeholder a
 * template exposes. Bulk fields with no bearing on rendering (Node's status.images image inventory and
 * volumesAttached/volumesInUse — the latter referencing specific real PV ids meaningless in synthetic data —
 * plus every template's uid/resourceVersion/selfLink/managedFields/ownerReferences/generateName/finalizers)
 * were stripped during extraction — anything else (labels, annotations, spec, status) is real example data,
 * kept as-is.
 */
export const DEMO_TEMPLATES: Record<string, RawObject> = {
  CSIDriver,
  CSINode,
  ClusterRole,
  ClusterRoleBinding,
  ConfigMap,
  CronJob,
  DaemonSet,
  Deployment,
  Endpoints,
  Event,
  Gateway,
  GatewayClass,
  HTTPRoute,
  Job,
  LimitRange,
  Namespace,
  NetworkPolicy,
  Node,
  PersistentVolume,
  PersistentVolumeClaim,
  Pod,
  ReplicaSet,
  ResourceQuota,
  Role,
  RoleBinding,
  Secret,
  Service,
  ServiceAccount,
  StatefulSet,
  StorageClass,
  VolumeAttachment,
};
