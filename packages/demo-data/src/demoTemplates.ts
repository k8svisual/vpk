import type { RawObject } from '@vpk/core';

/**
 * Demo/test-data templates — one representative raw object per Kind. Lives in its own package (not @vpk/core)
 * since this is test-data tooling, not domain logic every view depends on — @vpk/server is the only consumer
 * so far (see its `/demo/templates` endpoint), used by the "Demo Data" screen (App.tsx).
 *
 * Most templates were extracted from a real cluster capture (the "kitchen-sink-demo" snapshot used throughout
 * this app's manual testing) and stripped of instance-identity fields — curated to the ~32 Kinds VpK's
 * Wheel/Schematic/Field views actually recognize (kindColors.ts/kindIcons.ts/wheel.ts/schematic.ts/
 * controlPlane.ts/scene.ts) that were ALSO present in that snapshot.
 *
 * A few recognized Kinds aren't in any snapshot capture yet and were hand-authored instead, straight from the
 * official Gateway API docs (gateway-api.sigs.k8s.io) rather than guessed: GatewayClass, Gateway, HTTPRoute.
 * EndpointSlice, Ingress, ReplicationController still have no template — add one when needed.
 *
 * Intended as the seed data for a future "Demo data" generator: clone a template, substitute the `{{...}}`
 * placeholders, and inject the result into a snapshot to synthesize test data at scale.
 *
 * Placeholder convention: `{{name}}` / `{{namespace}}` replace metadata.name/namespace on every template;
 * `{{nodeName}}` replaces Pod's spec.nodeName; `{{gatewayName}}` replaces HTTPRoute's parentRefs[].name;
 * `{{serviceName}}` replaces HTTPRoute's backendRefs[].name. A generator is expected to substitute all of
 * these. Bulk fields with no bearing on rendering (Node's status.images image inventory, the object's own
 * uid/resourceVersion/selfLink/managedFields/ownerReferences/generateName/finalizers) were stripped during
 * extraction — anything else (labels, annotations, spec, status) is real example data, kept as-is.
 */
export const DEMO_TEMPLATES: Record<string, RawObject> = {
  "CSIDriver": {
    "apiVersion": "storage.k8s.io/v1beta1",
    "kind": "CSIDriver",
    "metadata": {
      "name": "{{name}}"
    },
    "spec": {
      "attachRequired": true,
      "podInfoOnMount": false,
      "volumeLifecycleModes": [
        "Persistent"
      ]
    }
  },
  "CSINode": {
    "apiVersion": "storage.k8s.io/v1",
    "kind": "CSINode",
    "metadata": {
      "name": "{{name}}"
    },
    "spec": {
      "drivers": [
        {
          "name": "openshift-storage.cephfs.csi.ceph.com",
          "nodeID": "master1.greedo.coc-ibm.com",
          "topologyKeys": null
        },
        {
          "name": "openshift-storage.rbd.csi.ceph.com",
          "nodeID": "master1.greedo.coc-ibm.com",
          "topologyKeys": null
        }
      ]
    }
  },
  "ClusterRole": {
    "apiVersion": "rbac.authorization.k8s.io/v1",
    "kind": "ClusterRole",
    "metadata": {
      "name": "{{name}}"
    },
    "rules": [
      {
        "apiGroups": [
          "authentication.k8s.io"
        ],
        "resources": [
          "tokenreviews"
        ],
        "verbs": [
          "create"
        ]
      },
      {
        "apiGroups": [
          "authorization.k8s.io"
        ],
        "resources": [
          "subjectaccessreviews"
        ],
        "verbs": [
          "create"
        ]
      }
    ]
  },
  "ClusterRoleBinding": {
    "apiVersion": "rbac.authorization.k8s.io/v1",
    "kind": "ClusterRoleBinding",
    "metadata": {
      "name": "{{name}}"
    },
    "roleRef": {
      "apiGroup": "rbac.authorization.k8s.io",
      "kind": "ClusterRole",
      "name": "cluster-admin"
    },
    "subjects": [
      {
        "apiGroup": "rbac.authorization.k8s.io",
        "kind": "User",
        "name": "monica.raffaelli1"
      }
    ]
  },
  "ConfigMap": {
    "apiVersion": "v1",
    "data": {
      "AuditLoggingHttpIngestURL": "https://common-audit-logging.ibm-common-services:9880/icp-audit.http",
      "AuditLoggingSyslogIngestURL": "https://common-audit-logging.ibm-common-services:5140"
    },
    "kind": "ConfigMap",
    "metadata": {
      "labels": {
        "app": "fluentd",
        "app.kubernetes.io/component": "common-audit-logging",
        "app.kubernetes.io/instance": "common-audit-logging",
        "app.kubernetes.io/managed-by": "operator",
        "app.kubernetes.io/name": "fluentd",
        "ibm-common-services.ibm-auditlogging-bindinfo/bindinfo": "true",
        "release": "common-audit-logging"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    }
  },
  "CronJob": {
    "apiVersion": "batch/v1beta1",
    "kind": "CronJob",
    "metadata": {
      "labels": {
        "app": "security_advisor",
        "app.kubernetes.io/instance": "multicluster-hub",
        "app.kubernetes.io/managed-by": "Helm",
        "app.kubernetes.io/name": "security_advisor",
        "chart": "security_advisor-3.3.0",
        "component": "security-advisor-onboarding",
        "helm.sh/chart": "security_advisor-3.3.0",
        "heritage": "Helm",
        "release": "multicluster-hub"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "concurrencyPolicy": "Replace",
      "failedJobsHistoryLimit": 1,
      "jobTemplate": {
        "metadata": {
          "creationTimestamp": null
        },
        "spec": {
          "template": {
            "metadata": {
              "creationTimestamp": null,
              "labels": {
                "app": "security_advisor",
                "app.kubernetes.io/instance": "multicluster-hub",
                "app.kubernetes.io/managed-by": "Helm",
                "app.kubernetes.io/name": "security_advisor",
                "chart": "security_advisor-3.3.0",
                "component": "security-advisor-onboarding",
                "helm.sh/chart": "security_advisor-3.3.0",
                "heritage": "Helm",
                "release": "multicluster-hub"
              },
              "name": "multicluster-hub-findings-pruning"
            },
            "spec": {
              "affinity": {
                "nodeAffinity": {
                  "requiredDuringSchedulingIgnoredDuringExecution": {
                    "nodeSelectorTerms": [
                      {
                        "matchExpressions": [
                          {
                            "key": "beta.kubernetes.io/arch",
                            "operator": "In",
                            "values": [
                              "amd64",
                              "ppc64le",
                              "s390x"
                            ]
                          }
                        ]
                      }
                    ]
                  }
                }
              },
              "containers": [
                {
                  "command": [
                    "scl",
                    "enable",
                    "rh-python36",
                    "python /usr/src/app/pruning.py"
                  ],
                  "env": [
                    {
                      "name": "ICP_API_KEY",
                      "valueFrom": {
                        "secretKeyRef": {
                          "key": "ICP_API_KEY",
                          "name": "icp-serviceid-apikey-secret"
                        }
                      }
                    },
                    {
                      "name": "CLUSTER_NAME",
                      "valueFrom": {
                        "configMapKeyRef": {
                          "key": "CLUSTER_NAME",
                          "name": "platform-auth-idp"
                        }
                      }
                    },
                    {
                      "name": "FINDINGS_OCCURRENCES_RETENTION_DAYS",
                      "valueFrom": {
                        "configMapKeyRef": {
                          "key": "FINDINGS_OCCURRENCES_RETENTION_DAYS",
                          "name": "multicluster-hub-findingsapi-configuration"
                        }
                      }
                    },
                    {
                      "name": "DELETE_ALL_FINDINGS_OCCURRENCES_BY_PROVIDERS",
                      "valueFrom": {
                        "configMapKeyRef": {
                          "key": "DELETE_ALL_FINDINGS_OCCURRENCES_BY_PROVIDERS",
                          "name": "multicluster-hub-findingsapi-configuration"
                        }
                      }
                    },
                    {
                      "name": "SA_NAMESPACE",
                      "valueFrom": {
                        "fieldRef": {
                          "apiVersion": "v1",
                          "fieldPath": "metadata.namespace"
                        }
                      }
                    },
                    {
                      "name": "INGRESS_SERVICE_URL",
                      "value": "https://icp-management-ingress:443"
                    }
                  ],
                  "image": "cp.icr.io/cp/cp4mcm/security-advisor-onboarding@sha256:23b4e02b703a835b4ea2e92eb0a127302b3c08c923cbba892b4d3d5f10596818",
                  "imagePullPolicy": "IfNotPresent",
                  "name": "multicluster-hub-security-advisor-onboarding",
                  "resources": {},
                  "securityContext": {
                    "allowPrivilegeEscalation": false,
                    "capabilities": {
                      "drop": [
                        "ALL"
                      ]
                    },
                    "privileged": false,
                    "readOnlyRootFilesystem": true,
                    "runAsNonRoot": true,
                    "runAsUser": 1000
                  },
                  "terminationMessagePath": "/dev/termination-log",
                  "terminationMessagePolicy": "File",
                  "volumeMounts": [
                    {
                      "mountPath": "/app/cluster-ca",
                      "name": "cluster-ca"
                    },
                    {
                      "mountPath": "/var/tmp",
                      "name": "tmp"
                    }
                  ]
                }
              ],
              "dnsPolicy": "ClusterFirst",
              "imagePullSecrets": [
                {
                  "name": "ibm-management-pull-secret"
                }
              ],
              "restartPolicy": "Never",
              "schedulerName": "default-scheduler",
              "securityContext": {},
              "terminationGracePeriodSeconds": 30,
              "tolerations": [
                {
                  "effect": "NoSchedule",
                  "key": "dedicated",
                  "operator": "Exists"
                }
              ],
              "volumes": [
                {
                  "name": "cluster-ca",
                  "secret": {
                    "defaultMode": 420,
                    "items": [
                      {
                        "key": "tls.key",
                        "path": "ca.key"
                      },
                      {
                        "key": "tls.crt",
                        "path": "ca.crt"
                      }
                    ],
                    "secretName": "icp-mongodb-client-cert"
                  }
                },
                {
                  "emptyDir": {},
                  "name": "tmp"
                }
              ]
            }
          }
        }
      },
      "schedule": "59 23 * * *",
      "successfulJobsHistoryLimit": 1,
      "suspend": false
    },
    "status": {
      "lastScheduleTime": "2020-12-02T23:59:00Z"
    }
  },
  "CustomResourceDefinition": {
    "apiVersion": "apiextensions.k8s.io/v1",
    "kind": "CustomResourceDefinition",
    "metadata": {
      "labels": {
        "app": "cluster-api-provider",
        "app.kubernetes.io/instance": "multicluster-hub",
        "app.kubernetes.io/managed-by": "Helm",
        "app.kubernetes.io/name": "cluster-api-provider",
        "chart": "cluster-api-provider-3.4.0",
        "component": "cluster-api-provider-aks",
        "controller-tools.k8s.io": "1.0",
        "helm.sh/chart": "cluster-api-provider-3.4.0",
        "heritage": "Helm",
        "release": "multicluster-hub"
      },
      "name": "{{name}}"
    },
    "spec": {
      "conversion": {
        "strategy": "None"
      },
      "group": "aks.mcm.ibm.com",
      "names": {
        "kind": "AKSClusterProviderSpec",
        "listKind": "AKSClusterProviderSpecList",
        "plural": "aksclusterproviderspecs",
        "singular": "aksclusterproviderspec"
      },
      "preserveUnknownFields": true,
      "scope": "Namespaced",
      "versions": [
        {
          "name": "v1alpha1",
          "schema": {
            "openAPIV3Schema": {
              "properties": {
                "apiVersion": {
                  "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#resources",
                  "type": "string"
                },
                "kind": {
                  "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#types-kinds",
                  "type": "string"
                },
                "metadata": {
                  "type": "object"
                },
                "spec": {
                  "properties": {
                    "dnsServiceIP": {
                      "type": "string"
                    },
                    "kubernetesVersion": {
                      "type": "string"
                    },
                    "location": {
                      "type": "string"
                    },
                    "nodeCount": {
                      "format": "int64",
                      "type": "integer"
                    },
                    "nodeOsdiskSize": {
                      "format": "int64",
                      "type": "integer"
                    },
                    "nodeVMSize": {
                      "type": "string"
                    },
                    "resourceGroupName": {
                      "type": "string"
                    },
                    "secretName": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "secretName",
                    "location",
                    "resourceGroupName"
                  ],
                  "type": "object"
                },
                "status": {
                  "type": "object"
                }
              }
            }
          },
          "served": true,
          "storage": true
        }
      ]
    },
    "status": {
      "acceptedNames": {
        "kind": "AKSClusterProviderSpec",
        "listKind": "AKSClusterProviderSpecList",
        "plural": "aksclusterproviderspecs",
        "singular": "aksclusterproviderspec"
      },
      "conditions": [
        {
          "lastTransitionTime": "2020-09-14T17:44:03Z",
          "message": "spec.validation.openAPIV3Schema.type: Required value: must not be empty at the root",
          "reason": "Violations",
          "status": "True",
          "type": "NonStructuralSchema"
        },
        {
          "lastTransitionTime": "2020-09-14T17:44:03Z",
          "message": "no conflicts found",
          "reason": "NoConflicts",
          "status": "True",
          "type": "NamesAccepted"
        },
        {
          "lastTransitionTime": "2020-09-14T17:44:03Z",
          "message": "the initial names have been accepted",
          "reason": "InitialNamesAccepted",
          "status": "True",
          "type": "Established"
        }
      ],
      "storedVersions": [
        "v1alpha1"
      ]
    }
  },
  "DaemonSet": {
    "apiVersion": "apps/v1",
    "kind": "DaemonSet",
    "metadata": {
      "annotations": {
        "deprecated.daemonset.template.generation": "8"
      },
      "labels": {
        "app": "fluentd",
        "app.kubernetes.io/component": "common-audit-logging",
        "app.kubernetes.io/instance": "common-audit-logging",
        "app.kubernetes.io/managed-by": "operator",
        "app.kubernetes.io/name": "fluentd",
        "release": "common-audit-logging"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "minReadySeconds": 5,
      "revisionHistoryLimit": 10,
      "selector": {
        "matchLabels": {
          "app": "fluentd",
          "auditlogging_cr": "example-auditlogging",
          "component": "common-audit-logging"
        }
      },
      "template": {
        "metadata": {
          "annotations": {
            "clusterhealth.ibm.com/dependencies": "cert-manager",
            "openshift.io/scc": "privileged",
            "productID": "068a62892a1e4db39641342e592daa25",
            "productMetric": "FREE",
            "productName": "IBM Cloud Platform Common Services"
          },
          "creationTimestamp": null,
          "labels": {
            "app": "fluentd",
            "app.kubernetes.io/component": "common-audit-logging",
            "app.kubernetes.io/instance": "common-audit-logging",
            "app.kubernetes.io/managed-by": "operator",
            "app.kubernetes.io/name": "fluentd",
            "auditlogging_cr": "example-auditlogging",
            "component": "common-audit-logging",
            "release": "common-audit-logging"
          }
        },
        "spec": {
          "affinity": {
            "nodeAffinity": {
              "requiredDuringSchedulingIgnoredDuringExecution": {
                "nodeSelectorTerms": [
                  {
                    "matchExpressions": [
                      {
                        "key": "beta.kubernetes.io/arch",
                        "operator": "In",
                        "values": [
                          "amd64",
                          "ppc64le",
                          "s390x"
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          "containers": [
            {
              "env": [
                {
                  "name": "ENABLE_AUDIT_LOGGING_FORWARDING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "ENABLE_AUDIT_LOGGING_FORWARDING",
                      "name": "audit-logging-fluentd-ds-config"
                    }
                  }
                }
              ],
              "image": "quay.io/opencloudio/fluentd@sha256:bebccda15d44814ccabb21545673e9424b1c34449e8936182d8c1f416297b9a7",
              "imagePullPolicy": "IfNotPresent",
              "livenessProbe": {
                "exec": {
                  "command": [
                    "ls",
                    "/tmp"
                  ]
                },
                "failureThreshold": 3,
                "initialDelaySeconds": 2,
                "periodSeconds": 2,
                "successThreshold": 1,
                "timeoutSeconds": 1
              },
              "name": "fluentd",
              "ports": [
                {
                  "containerPort": 9880,
                  "protocol": "TCP"
                }
              ],
              "readinessProbe": {
                "exec": {
                  "command": [
                    "bash",
                    "-c",
                    "exec echo start"
                  ]
                },
                "failureThreshold": 3,
                "initialDelaySeconds": 10,
                "periodSeconds": 10,
                "successThreshold": 1,
                "timeoutSeconds": 2
              },
              "resources": {
                "limits": {
                  "cpu": "300m",
                  "memory": "400Mi"
                },
                "requests": {
                  "cpu": "25m",
                  "memory": "100Mi"
                }
              },
              "securityContext": {
                "allowPrivilegeEscalation": true,
                "capabilities": {
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": true,
                "readOnlyRootFilesystem": true,
                "runAsNonRoot": false,
                "runAsUser": 0
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/fluentd/etc/fluent.conf",
                  "name": "main-config",
                  "subPath": "fluent.conf"
                },
                {
                  "mountPath": "/fluentd/etc/source.conf",
                  "name": "source-config",
                  "subPath": "source.conf"
                },
                {
                  "mountPath": "/fluentd/etc/remoteSyslog.conf",
                  "name": "remote-syslog-config",
                  "subPath": "remoteSyslog.conf"
                },
                {
                  "mountPath": "/fluentd/etc/splunkHEC.conf",
                  "name": "splunk-hec-config",
                  "subPath": "splunkHEC.conf"
                },
                {
                  "mountPath": "/run/log/journal",
                  "name": "journal",
                  "readOnly": true
                },
                {
                  "mountPath": "/icp-audit",
                  "name": "shared"
                },
                {
                  "mountPath": "/tmp",
                  "name": "shared"
                },
                {
                  "mountPath": "/fluentd/etc/tls",
                  "name": "audit-certs",
                  "readOnly": true
                },
                {
                  "mountPath": "/fluentd/etc/https",
                  "name": "audit-server-certs",
                  "readOnly": true
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Always",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "ibm-auditlogging-operand",
          "serviceAccountName": "ibm-auditlogging-operand",
          "terminationGracePeriodSeconds": 30,
          "tolerations": [
            {
              "effect": "NoSchedule",
              "key": "dedicated",
              "operator": "Exists"
            },
            {
              "key": "CriticalAddonsOnly",
              "operator": "Exists"
            }
          ],
          "volumes": [
            {
              "hostPath": {
                "path": "/run/log/journal",
                "type": ""
              },
              "name": "journal"
            },
            {
              "configMap": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "fluent.conf",
                    "path": "fluent.conf"
                  }
                ],
                "name": "audit-logging-fluentd-ds-config"
              },
              "name": "main-config"
            },
            {
              "configMap": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "source.conf",
                    "path": "source.conf"
                  }
                ],
                "name": "audit-logging-fluentd-ds-source-config"
              },
              "name": "source-config"
            },
            {
              "configMap": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "remoteSyslog.conf",
                    "path": "remoteSyslog.conf"
                  }
                ],
                "name": "audit-logging-fluentd-ds-remote-syslog-config"
              },
              "name": "remote-syslog-config"
            },
            {
              "configMap": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "splunkHEC.conf",
                    "path": "splunkHEC.conf"
                  }
                ],
                "name": "audit-logging-fluentd-ds-splunk-hec-config"
              },
              "name": "splunk-hec-config"
            },
            {
              "emptyDir": {},
              "name": "shared"
            },
            {
              "name": "audit-certs",
              "secret": {
                "defaultMode": 420,
                "secretName": "audit-certs"
              }
            },
            {
              "name": "audit-server-certs",
              "secret": {
                "defaultMode": 420,
                "secretName": "audit-server-certs"
              }
            }
          ]
        }
      },
      "updateStrategy": {
        "rollingUpdate": {
          "maxUnavailable": 1
        },
        "type": "RollingUpdate"
      }
    },
    "status": {
      "currentNumberScheduled": 9,
      "desiredNumberScheduled": 9,
      "numberAvailable": 9,
      "numberMisscheduled": 0,
      "numberReady": 9,
      "observedGeneration": 8,
      "updatedNumberScheduled": 9
    }
  },
  "Deployment": {
    "apiVersion": "apps/v1",
    "kind": "Deployment",
    "metadata": {
      "annotations": {
        "deployment.kubernetes.io/revision": "1"
      },
      "labels": {
        "ibm-management-orchestrator.management.ibm.com": "ibm-management.cp4m"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "progressDeadlineSeconds": 600,
      "replicas": 1,
      "revisionHistoryLimit": 10,
      "selector": {
        "matchLabels": {
          "app": "ibm-management-catalog"
        }
      },
      "strategy": {
        "rollingUpdate": {
          "maxSurge": "25%",
          "maxUnavailable": "25%"
        },
        "type": "RollingUpdate"
      },
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "app": "ibm-management-catalog"
          }
        },
        "spec": {
          "containers": [
            {
              "image": "cp.icr.io/cp/cp4mcm/cp4mcm-operator-catalog@sha256:2c39ee0ca65f968cc45a00a3e32c25dd6e32910635ed3bd9baae58c9c8875ed9",
              "imagePullPolicy": "IfNotPresent",
              "livenessProbe": {
                "exec": {
                  "command": [
                    "grpc_health_probe",
                    "-addr=localhost:50051"
                  ]
                },
                "failureThreshold": 3,
                "initialDelaySeconds": 10,
                "periodSeconds": 10,
                "successThreshold": 1,
                "timeoutSeconds": 1
              },
              "name": "ibm-management-registry-server",
              "ports": [
                {
                  "containerPort": 50051,
                  "name": "grpc",
                  "protocol": "TCP"
                }
              ],
              "readinessProbe": {
                "exec": {
                  "command": [
                    "grpc_health_probe",
                    "-addr=localhost:50051"
                  ]
                },
                "failureThreshold": 3,
                "initialDelaySeconds": 5,
                "periodSeconds": 10,
                "successThreshold": 1,
                "timeoutSeconds": 5
              },
              "resources": {
                "requests": {
                  "cpu": "10m",
                  "memory": "50Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File"
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "imagePullSecrets": [
            {
              "name": "ibm-management-pull-secret"
            }
          ],
          "restartPolicy": "Always",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "default",
          "serviceAccountName": "default",
          "terminationGracePeriodSeconds": 30
        }
      }
    },
    "status": {
      "availableReplicas": 1,
      "conditions": [
        {
          "lastTransitionTime": "2020-09-14T17:14:59Z",
          "lastUpdateTime": "2020-09-14T17:14:59Z",
          "message": "Deployment has minimum availability.",
          "reason": "MinimumReplicasAvailable",
          "status": "True",
          "type": "Available"
        },
        {
          "lastTransitionTime": "2020-09-14T17:14:42Z",
          "lastUpdateTime": "2020-09-14T17:14:59Z",
          "message": "ReplicaSet \"ibm-management-catalog-deployment-569c88d69c\" has successfully progressed.",
          "reason": "NewReplicaSetAvailable",
          "status": "True",
          "type": "Progressing"
        }
      ],
      "observedGeneration": 1,
      "readyReplicas": 1,
      "replicas": 1,
      "updatedReplicas": 1
    }
  },
  "Endpoints": {
    "apiVersion": "v1",
    "kind": "Endpoints",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "subsets": [
      {
        "addresses": [
          {
            "ip": "10.171.97.96"
          },
          {
            "ip": "169.46.93.131"
          }
        ]
      }
    ]
  },
  "Event": {
    "apiVersion": "v1",
    "count": 172,
    "eventTime": null,
    "firstTimestamp": "2020-11-25T02:17:51Z",
    "involvedObject": {
      "apiVersion": "infra.management.ibm.com/v1alpha1",
      "kind": "VirtualMachine",
      "name": "cfvmid-16",
      "namespace": "cp4m",
      "resourceVersion": "125413764",
      "uid": "2f6634aa-e982-485d-8a5c-1cf686498fdf"
    },
    "kind": "Event",
    "lastTimestamp": "2020-12-03T16:49:12Z",
    "message": "GetVirtualMachine changed for cp4m/cfvmid-16: Get \"http://web-service.management-infrastructure-management.svc.cluster.local:3000/api/vms/16?expand=tags&attributes=ipaddresses,storages,hostnames,os_image_name,operating_system,tenant,miq_provision\": dial tcp 172.30.229.21:3000: connect: connection refused",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "reason": "GetVirtualMachine:Failed",
    "reportingComponent": "",
    "reportingInstance": "",
    "source": {
      "component": "cf-controller-virtualmachine"
    },
    "type": "Normal"
  },
  "HorizontalPodAutoscaler": {
    "apiVersion": "autoscaling/v1",
    "kind": "HorizontalPodAutoscaler",
    "metadata": {
      "annotations": {
        "autoscaling.alpha.kubernetes.io/conditions": "[{\"type\":\"AbleToScale\",\"status\":\"True\",\"lastTransitionTime\":\"2020-12-01T07:14:58Z\",\"reason\":\"ReadyForNewScale\",\"message\":\"recommended size matches current size\"},{\"type\":\"ScalingActive\",\"status\":\"True\",\"lastTransitionTime\":\"2020-11-29T08:45:47Z\",\"reason\":\"ValidMetricFound\",\"message\":\"the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)\"},{\"type\":\"ScalingLimited\",\"status\":\"True\",\"lastTransitionTime\":\"2020-11-30T22:10:44Z\",\"reason\":\"TooFewReplicas\",\"message\":\"the desired replica count is less than the minimum replica count\"}]",
        "autoscaling.alpha.kubernetes.io/current-metrics": "[{\"type\":\"Resource\",\"resource\":{\"name\":\"cpu\",\"currentAverageUtilization\":0,\"currentAverageValue\":\"2m\"}}]"
      },
      "labels": {
        "app": "noobaa"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "maxReplicas": 1,
      "minReplicas": 1,
      "scaleTargetRef": {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "name": "noobaa-endpoint"
      },
      "targetCPUUtilizationPercentage": 80
    },
    "status": {
      "currentCPUUtilizationPercentage": 0,
      "currentReplicas": 1,
      "desiredReplicas": 1
    }
  },
  "Job": {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
      "labels": {
        "app": "iam-onboarding",
        "app.kubernetes.io/instance": "iam-onboarding"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "backoffLimit": 6,
      "completions": 1,
      "parallelism": 1,
      "selector": {
        "matchLabels": {
          "controller-uid": "3b4421be-bbc7-48d4-93c6-b75f9a9a71a9"
        }
      },
      "template": {
        "metadata": {
          "annotations": {
            "clusterhealth.ibm.com/dependencies": "cert-manager, common-mongodb, icp-management-ingress",
            "productID": "068a62892a1e4db39641342e592daa25",
            "productMetric": "FREE",
            "productName": "IBM Cloud Platform Common Services",
            "productVersion": "3.4.0",
            "scheduler.alpha.kubernetes.io/critical-pod": ""
          },
          "creationTimestamp": null,
          "labels": {
            "controller-uid": "3b4421be-bbc7-48d4-93c6-b75f9a9a71a9",
            "job-name": "iam-onboarding"
          },
          "name": "iam-onboarding"
        },
        "spec": {
          "containers": [
            {
              "command": [
                "python",
                "/app/acs_utils/build/icp_iam_am_bootstrap.py"
              ],
              "env": [
                {
                  "name": "DEFAULT_ADMIN_USER",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "admin_username",
                      "name": "platform-auth-idp-credentials"
                    }
                  }
                },
                {
                  "name": "AUDIT_ENABLED",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "AUDIT_ENABLED",
                      "name": "auth-pdp"
                    }
                  }
                },
                {
                  "name": "DEFAULT_ADMIN_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "admin_password",
                      "name": "platform-auth-idp-credentials"
                    }
                  }
                },
                {
                  "name": "POD_NAME",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.name"
                    }
                  }
                },
                {
                  "name": "POD_NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "platform-auth-idp"
                    }
                  }
                },
                {
                  "name": "MONGO_DB",
                  "value": "platform-db"
                },
                {
                  "name": "MONGO_COLLECTION",
                  "value": "iam"
                },
                {
                  "name": "MONGO_USERNAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "user",
                      "name": "icp-mongodb-admin"
                    }
                  }
                },
                {
                  "name": "MONGO_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "password",
                      "name": "icp-mongodb-admin"
                    }
                  }
                },
                {
                  "name": "MONGO_HOST",
                  "value": "mongodb"
                },
                {
                  "name": "MONGO_PORT",
                  "value": "27017"
                },
                {
                  "name": "MONGO_AUTHSOURCE",
                  "value": "admin"
                },
                {
                  "name": "CF_DB_NAME",
                  "value": "security-data"
                },
                {
                  "name": "DB_NAME",
                  "value": "platform-db"
                },
                {
                  "name": "CAMS_PDP_URL",
                  "value": "https://iam-pdp:7998"
                },
                {
                  "name": "IAM_TOKEN_SERVICE_URL",
                  "value": "https://platform-auth-service:9443"
                },
                {
                  "name": "IDENTITY_PROVIDER_URL",
                  "value": "https://platform-identity-provider:4300"
                },
                {
                  "name": "IAM_PAP_URL",
                  "value": "https://iam-pap:39001"
                },
                {
                  "name": "NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "DEFAULT_TTL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "PDP_REDIS_CACHE_DEFAULT_TTL",
                      "name": "platform-auth-idp"
                    }
                  }
                },
                {
                  "name": "WORKERS",
                  "value": "15"
                }
              ],
              "image": "quay.io/opencloudio/icp-iam-onboarding@sha256:f8efc1d236be029376eb73ff57270695b94b33cceed8aee57f7fb5edc8c488e6",
              "imagePullPolicy": "Always",
              "name": "iam-onboarding",
              "resources": {
                "limits": {
                  "cpu": "200m",
                  "memory": "1Gi"
                },
                "requests": {
                  "cpu": "20m",
                  "memory": "64Mi"
                }
              },
              "securityContext": {
                "allowPrivilegeEscalation": false,
                "capabilities": {
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": false,
                "readOnlyRootFilesystem": true,
                "runAsNonRoot": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/certs/mongodb-ca",
                  "name": "mongodb-ca-cert"
                },
                {
                  "mountPath": "/certs/auth-pdp",
                  "name": "auth-pdp-secret"
                },
                {
                  "mountPath": "/certs",
                  "name": "cluster-ca"
                },
                {
                  "mountPath": "/app/logs/audit",
                  "name": "shared"
                },
                {
                  "mountPath": "/certs/mongodb-client",
                  "name": "mongodb-client-cert"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "initContainers": [
            {
              "command": [
                "sh",
                "-c",
                "sleep 75; until curl -k -i -fsS https://platform-auth-service:9443/oidc/endpoint/OP/.well-known/openid-configuration | grep '200 OK'; do sleep 3; done;"
              ],
              "image": "quay.io/opencloudio/icp-platform-auth@sha256:a5020f5ce596d4def3060031cb7f6a6d44fd591fb1253e3ad0b8c9ed1152bc9a",
              "imagePullPolicy": "Always",
              "name": "init-auth-service",
              "resources": {
                "limits": {
                  "cpu": "200m",
                  "memory": "256Mi"
                },
                "requests": {
                  "cpu": "100m",
                  "memory": "128Mi"
                }
              },
              "securityContext": {
                "allowPrivilegeEscalation": false,
                "capabilities": {
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": false,
                "readOnlyRootFilesystem": true,
                "runAsNonRoot": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File"
            },
            {
              "command": [
                "sh",
                "-c",
                "until curl -k -i -fsS https://platform-identity-provider:4300 | grep '200 OK'; do sleep 3; done;"
              ],
              "image": "quay.io/opencloudio/icp-platform-auth@sha256:a5020f5ce596d4def3060031cb7f6a6d44fd591fb1253e3ad0b8c9ed1152bc9a",
              "imagePullPolicy": "Always",
              "name": "init-identity-provider",
              "resources": {
                "limits": {
                  "cpu": "200m",
                  "memory": "256Mi"
                },
                "requests": {
                  "cpu": "100m",
                  "memory": "128Mi"
                }
              },
              "securityContext": {
                "allowPrivilegeEscalation": false,
                "capabilities": {
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": false,
                "readOnlyRootFilesystem": true,
                "runAsNonRoot": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/certs",
                  "name": "cluster-ca"
                }
              ]
            },
            {
              "command": [
                "sh",
                "-c",
                "until curl -k -i -fsS https://platform-identity-management:4500 | grep '200 OK'; do sleep 3; done;"
              ],
              "image": "quay.io/opencloudio/icp-platform-auth@sha256:a5020f5ce596d4def3060031cb7f6a6d44fd591fb1253e3ad0b8c9ed1152bc9a",
              "imagePullPolicy": "Always",
              "name": "init-identity-manager",
              "resources": {
                "limits": {
                  "cpu": "200m",
                  "memory": "256Mi"
                },
                "requests": {
                  "cpu": "100m",
                  "memory": "128Mi"
                }
              },
              "securityContext": {
                "allowPrivilegeEscalation": false,
                "capabilities": {
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": false,
                "readOnlyRootFilesystem": true,
                "runAsNonRoot": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/certs",
                  "name": "cluster-ca"
                }
              ]
            },
            {
              "command": [
                "sh",
                "-c",
                "until curl -k -i -fsS https://platform-auth-service:9443/iam/oidc/keys | grep '200 OK'; do sleep 3; done;"
              ],
              "image": "quay.io/opencloudio/icp-platform-auth@sha256:a5020f5ce596d4def3060031cb7f6a6d44fd591fb1253e3ad0b8c9ed1152bc9a",
              "imagePullPolicy": "Always",
              "name": "init-token-service",
              "resources": {
                "limits": {
                  "cpu": "200m",
                  "memory": "256Mi"
                },
                "requests": {
                  "cpu": "100m",
                  "memory": "128Mi"
                }
              },
              "securityContext": {
                "allowPrivilegeEscalation": false,
                "capabilities": {
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": false,
                "readOnlyRootFilesystem": true,
                "runAsNonRoot": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File"
            },
            {
              "command": [
                "sh",
                "-c",
                "until curl -k -i -fsS https://iam-pap:39001/v1/health | grep '200 OK'; do sleep 3; done;"
              ],
              "image": "quay.io/opencloudio/icp-platform-auth@sha256:a5020f5ce596d4def3060031cb7f6a6d44fd591fb1253e3ad0b8c9ed1152bc9a",
              "imagePullPolicy": "Always",
              "name": "init-pap",
              "resources": {
                "limits": {
                  "cpu": "200m",
                  "memory": "256Mi"
                },
                "requests": {
                  "cpu": "100m",
                  "memory": "128Mi"
                }
              },
              "securityContext": {
                "allowPrivilegeEscalation": false,
                "capabilities": {
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": false,
                "readOnlyRootFilesystem": true,
                "runAsNonRoot": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/certs",
                  "name": "cluster-ca"
                }
              ]
            }
          ],
          "restartPolicy": "OnFailure",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "ibm-iam-operand-restricted",
          "serviceAccountName": "ibm-iam-operand-restricted",
          "terminationGracePeriodSeconds": 30,
          "tolerations": [
            {
              "effect": "NoSchedule",
              "key": "dedicated",
              "operator": "Exists"
            },
            {
              "key": "CriticalAddonsOnly",
              "operator": "Exists"
            }
          ],
          "volumes": [
            {
              "name": "mongodb-ca-cert",
              "secret": {
                "defaultMode": 420,
                "secretName": "mongodb-root-ca-cert"
              }
            },
            {
              "name": "cluster-ca",
              "secret": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "tls.key",
                    "path": "ca.key"
                  },
                  {
                    "key": "tls.crt",
                    "path": "ca.crt"
                  }
                ],
                "secretName": "cs-ca-certificate-secret"
              }
            },
            {
              "name": "auth-pdp-secret",
              "secret": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "tls.key",
                    "path": "ca.key"
                  },
                  {
                    "key": "tls.crt",
                    "path": "ca.crt"
                  }
                ],
                "secretName": "auth-pdp-secret"
              }
            },
            {
              "emptyDir": {},
              "name": "shared"
            },
            {
              "configMap": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "logrotate",
                    "path": "audit"
                  }
                ],
                "name": "auth-pdp"
              },
              "name": "logrotate"
            },
            {
              "configMap": {
                "defaultMode": 420,
                "items": [
                  {
                    "key": "logrotate-conf",
                    "path": "logrotate.conf"
                  }
                ],
                "name": "auth-pdp"
              },
              "name": "logrotate-conf"
            },
            {
              "name": "mongodb-client-cert",
              "secret": {
                "defaultMode": 420,
                "secretName": "icp-mongodb-client-cert"
              }
            }
          ]
        }
      }
    },
    "status": {
      "completionTime": "2020-09-14T17:35:03Z",
      "conditions": [
        {
          "lastProbeTime": "2020-09-14T17:35:03Z",
          "lastTransitionTime": "2020-09-14T17:35:03Z",
          "status": "True",
          "type": "Complete"
        }
      ],
      "startTime": "2020-09-14T17:25:53Z",
      "succeeded": 1
    }
  },
  "LimitRange": {
    "apiVersion": "v1",
    "kind": "LimitRange",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "limits": [
        {
          "default": {
            "cpu": "500m",
            "memory": "512Mi"
          },
          "defaultRequest": {
            "cpu": "100m",
            "memory": "128Mi"
          },
          "type": "Container"
        }
      ]
    }
  },
  "Namespace": {
    "apiVersion": "v1",
    "kind": "Namespace",
    "metadata": {
      "annotations": {
        "kubectl.kubernetes.io/last-applied-configuration": "{\"apiVersion\":\"v1\",\"kind\":\"Namespace\",\"metadata\":{\"annotations\":{},\"name\":\"bookinfo\"}}\n",
        "mcm.ibm.com/accountID": "id-mycluster-account",
        "mcm.ibm.com/type": "System",
        "openshift.io/sa.scc.mcs": "s0:c28,c7",
        "openshift.io/sa.scc.supplemental-groups": "1000770000/10000",
        "openshift.io/sa.scc.uid-range": "1000770000/10000"
      },
      "name": "{{name}}"
    },
    "spec": {
      "finalizers": [
        "kubernetes"
      ]
    },
    "status": {
      "phase": "Active"
    }
  },
  "NetworkPolicy": {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "NetworkPolicy",
    "metadata": {
      "labels": {
        "app": "security_advisor",
        "app.kubernetes.io/instance": "multicluster-hub",
        "app.kubernetes.io/managed-by": "Helm",
        "app.kubernetes.io/name": "security_advisor",
        "chart": "security_advisor-3.3.0",
        "component": "findingsapi",
        "helm.sh/chart": "security_advisor-3.3.0",
        "heritage": "Helm",
        "release": "multicluster-hub"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "ingress": [
        {
          "from": [
            {
              "namespaceSelector": {}
            },
            {
              "podSelector": {
                "matchLabels": {
                  "microservice": "multicluster-hub-opsmgr"
                }
              }
            }
          ]
        }
      ],
      "podSelector": {
        "matchLabels": {
          "microservice": "multicluster-hub-findingsapi"
        }
      },
      "policyTypes": [
        "Ingress"
      ]
    }
  },
  "Node": {
    "apiVersion": "v1",
    "kind": "Node",
    "metadata": {
      "annotations": {
        "csi.volume.kubernetes.io/nodeid": "{\"openshift-storage.cephfs.csi.ceph.com\":\"master1.greedo.coc-ibm.com\"}",
        "machineconfiguration.openshift.io/currentConfig": "rendered-master-9a57e59f4c3fa23a078707123d09935d",
        "machineconfiguration.openshift.io/desiredConfig": "rendered-master-9a57e59f4c3fa23a078707123d09935d",
        "machineconfiguration.openshift.io/reason": "",
        "machineconfiguration.openshift.io/state": "Done",
        "volumes.kubernetes.io/controller-managed-attach-detach": "true"
      },
      "labels": {
        "beta.kubernetes.io/arch": "amd64",
        "beta.kubernetes.io/os": "linux",
        "kubernetes.io/arch": "amd64",
        "kubernetes.io/hostname": "master1.greedo.coc-ibm.com",
        "kubernetes.io/os": "linux",
        "node-role.kubernetes.io/master": "",
        "node-role.kubernetes.io/worker": "",
        "node.openshift.io/os_id": "rhcos"
      },
      "name": "{{name}}"
    },
    "spec": {},
    "status": {
      "addresses": [
        {
          "address": "192.168.10.91",
          "type": "InternalIP"
        },
        {
          "address": "master1.greedo.coc-ibm.com",
          "type": "Hostname"
        }
      ],
      "allocatable": {
        "cpu": "15500m",
        "ephemeral-storage": "191691103528",
        "hugepages-2Mi": "0",
        "memory": "64812764Ki",
        "pods": "250"
      },
      "capacity": {
        "cpu": "16",
        "ephemeral-storage": "209163244Ki",
        "hugepages-2Mi": "0",
        "memory": "65963740Ki",
        "pods": "250"
      },
      "conditions": [
        {
          "lastHeartbeatTime": "2020-12-03T17:18:24Z",
          "lastTransitionTime": "2020-09-14T15:00:01Z",
          "message": "kubelet has sufficient memory available",
          "reason": "KubeletHasSufficientMemory",
          "status": "False",
          "type": "MemoryPressure"
        },
        {
          "lastHeartbeatTime": "2020-12-03T17:18:24Z",
          "lastTransitionTime": "2020-09-14T15:00:01Z",
          "message": "kubelet has no disk pressure",
          "reason": "KubeletHasNoDiskPressure",
          "status": "False",
          "type": "DiskPressure"
        },
        {
          "lastHeartbeatTime": "2020-12-03T17:18:24Z",
          "lastTransitionTime": "2020-09-14T15:00:01Z",
          "message": "kubelet has sufficient PID available",
          "reason": "KubeletHasSufficientPID",
          "status": "False",
          "type": "PIDPressure"
        },
        {
          "lastHeartbeatTime": "2020-12-03T17:18:24Z",
          "lastTransitionTime": "2020-09-14T15:01:21Z",
          "message": "kubelet is posting ready status",
          "reason": "KubeletReady",
          "status": "True",
          "type": "Ready"
        }
      ],
      "daemonEndpoints": {
        "kubeletEndpoint": {
          "Port": 10250
        }
      },
      "nodeInfo": {
        "architecture": "amd64",
        "bootID": "31c418a8-c0e6-48f5-b8b2-bdb6e1ea8420",
        "containerRuntimeVersion": "cri-o://1.17.4-12.dev.rhaos4.4.git2be4d9c.el8",
        "kernelVersion": "4.18.0-147.8.1.el8_1.x86_64",
        "kubeProxyVersion": "v1.17.1",
        "kubeletVersion": "v1.17.1",
        "machineID": "280d6424f2104fc7b7c73a8d92576843",
        "operatingSystem": "linux",
        "osImage": "Red Hat Enterprise Linux CoreOS 44.81.202005250830-0 (Ootpa)",
        "systemUUID": "280d6424-f210-4fc7-b7c7-3a8d92576843"
      },
      "volumesAttached": [
        {
          "devicePath": "",
          "name": "kubernetes.io/csi/openshift-storage.rbd.csi.ceph.com^0001-0011-openshift-storage-0000000000000002-d8493229-f6d1-11ea-96b9-0a580a83020a"
        },
        {
          "devicePath": "",
          "name": "kubernetes.io/csi/openshift-storage.rbd.csi.ceph.com^0001-0011-openshift-storage-0000000000000002-0df5e4e6-f6ae-11ea-96b9-0a580a83020a"
        },
        {
          "devicePath": "",
          "name": "kubernetes.io/csi/openshift-storage.rbd.csi.ceph.com^0001-0011-openshift-storage-0000000000000002-e1e8495c-f6b1-11ea-96b9-0a580a83020a"
        }
      ],
      "volumesInUse": [
        "kubernetes.io/csi/openshift-storage.rbd.csi.ceph.com^0001-0011-openshift-storage-0000000000000002-0df5e4e6-f6ae-11ea-96b9-0a580a83020a",
        "kubernetes.io/csi/openshift-storage.rbd.csi.ceph.com^0001-0011-openshift-storage-0000000000000002-d8493229-f6d1-11ea-96b9-0a580a83020a",
        "kubernetes.io/csi/openshift-storage.rbd.csi.ceph.com^0001-0011-openshift-storage-0000000000000002-e1e8495c-f6b1-11ea-96b9-0a580a83020a"
      ]
    }
  },
  "PersistentVolume": {
    "apiVersion": "v1",
    "kind": "PersistentVolume",
    "metadata": {
      "annotations": {
        "pv.kubernetes.io/bound-by-controller": "yes",
        "pv.kubernetes.io/provisioned-by": "local-volume-provisioner-worker6.greedo.coc-ibm.com-2cd59971-bef0-4924-acfc-7d8d82b905e9"
      },
      "labels": {
        "storage.openshift.com/local-volume-owner-name": "local-disks-fs",
        "storage.openshift.com/local-volume-owner-namespace": "local-storage"
      },
      "name": "{{name}}"
    },
    "spec": {
      "accessModes": [
        "ReadWriteOnce"
      ],
      "capacity": {
        "storage": "10Gi"
      },
      "claimRef": {
        "apiVersion": "v1",
        "kind": "PersistentVolumeClaim",
        "name": "rook-ceph-mon-a",
        "namespace": "openshift-storage",
        "resourceVersion": "45537",
        "uid": "4a4beb74-2267-4254-b005-d88141938fe8"
      },
      "local": {
        "path": "/mnt/local-storage/local-sc/vdb"
      },
      "nodeAffinity": {
        "required": {
          "nodeSelectorTerms": [
            {
              "matchExpressions": [
                {
                  "key": "kubernetes.io/hostname",
                  "operator": "In",
                  "values": [
                    "worker6.greedo.coc-ibm.com"
                  ]
                }
              ]
            }
          ]
        }
      },
      "persistentVolumeReclaimPolicy": "Delete",
      "storageClassName": "local-sc",
      "volumeMode": "Filesystem"
    },
    "status": {
      "phase": "Bound"
    }
  },
  "PersistentVolumeClaim": {
    "apiVersion": "v1",
    "kind": "PersistentVolumeClaim",
    "metadata": {
      "annotations": {
        "pv.kubernetes.io/bind-completed": "yes",
        "pv.kubernetes.io/bound-by-controller": "yes",
        "volume.beta.kubernetes.io/storage-provisioner": "nfs/provisioner"
      },
      "labels": {
        "alertmanager": "ibm-monitoring-alertmanager",
        "app": "alertmanager"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "accessModes": [
        "ReadWriteOnce"
      ],
      "resources": {
        "requests": {
          "storage": "10Gi"
        }
      },
      "storageClassName": "managed-nfs-storage",
      "volumeMode": "Filesystem",
      "volumeName": "pvc-35a7e06b-4262-46c4-844b-916cf21e2fb8"
    },
    "status": {
      "accessModes": [
        "ReadWriteOnce"
      ],
      "capacity": {
        "storage": "10Gi"
      },
      "phase": "Bound"
    }
  },
  "Pod": {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
      "annotations": {
        "k8s.v1.cni.cncf.io/networks-status": "[{\n    \"name\": \"openshift-sdn\",\n    \"interface\": \"eth0\",\n    \"ips\": [\n        \"10.128.2.11\"\n    ],\n    \"dns\": {},\n    \"default-route\": [\n        \"10.128.2.1\"\n    ]\n}]",
        "openshift.io/scc": "restricted"
      },
      "labels": {
        "app": "ibm-management-catalog",
        "pod-template-hash": "569c88d69c"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "containers": [
        {
          "image": "cp.icr.io/cp/cp4mcm/cp4mcm-operator-catalog@sha256:2c39ee0ca65f968cc45a00a3e32c25dd6e32910635ed3bd9baae58c9c8875ed9",
          "imagePullPolicy": "IfNotPresent",
          "livenessProbe": {
            "exec": {
              "command": [
                "grpc_health_probe",
                "-addr=localhost:50051"
              ]
            },
            "failureThreshold": 3,
            "initialDelaySeconds": 10,
            "periodSeconds": 10,
            "successThreshold": 1,
            "timeoutSeconds": 1
          },
          "name": "ibm-management-registry-server",
          "ports": [
            {
              "containerPort": 50051,
              "name": "grpc",
              "protocol": "TCP"
            }
          ],
          "readinessProbe": {
            "exec": {
              "command": [
                "grpc_health_probe",
                "-addr=localhost:50051"
              ]
            },
            "failureThreshold": 3,
            "initialDelaySeconds": 5,
            "periodSeconds": 10,
            "successThreshold": 1,
            "timeoutSeconds": 5
          },
          "resources": {
            "requests": {
              "cpu": "10m",
              "memory": "50Mi"
            }
          },
          "securityContext": {
            "capabilities": {
              "drop": [
                "KILL",
                "MKNOD",
                "SETGID",
                "SETUID"
              ]
            },
            "runAsUser": 1000650000
          },
          "terminationMessagePath": "/dev/termination-log",
          "terminationMessagePolicy": "File",
          "volumeMounts": [
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "default-token-l2gbz",
              "readOnly": true
            }
          ]
        }
      ],
      "dnsPolicy": "ClusterFirst",
      "enableServiceLinks": true,
      "imagePullSecrets": [
        {
          "name": "ibm-management-pull-secret"
        }
      ],
      "nodeName": "{{nodeName}}",
      "priority": 0,
      "restartPolicy": "Always",
      "schedulerName": "default-scheduler",
      "securityContext": {
        "fsGroup": 1000650000,
        "seLinuxOptions": {
          "level": "s0:c26,c0"
        }
      },
      "serviceAccount": "default",
      "serviceAccountName": "default",
      "terminationGracePeriodSeconds": 30,
      "tolerations": [
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/not-ready",
          "operator": "Exists",
          "tolerationSeconds": 300
        },
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/unreachable",
          "operator": "Exists",
          "tolerationSeconds": 300
        },
        {
          "effect": "NoSchedule",
          "key": "node.kubernetes.io/memory-pressure",
          "operator": "Exists"
        }
      ],
      "volumes": [
        {
          "name": "default-token-l2gbz",
          "secret": {
            "defaultMode": 420,
            "secretName": "default-token-l2gbz"
          }
        }
      ]
    },
    "status": {
      "conditions": [
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2020-09-14T17:14:42Z",
          "status": "True",
          "type": "Initialized"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2020-09-14T17:14:59Z",
          "status": "True",
          "type": "Ready"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2020-09-14T17:14:59Z",
          "status": "True",
          "type": "ContainersReady"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2020-09-14T17:14:42Z",
          "status": "True",
          "type": "PodScheduled"
        }
      ],
      "containerStatuses": [
        {
          "containerID": "cri-o://d9ffe4ca680922c79886d324b90f13b642d01b47c6e4beff7aff8841468737ab",
          "image": "cp.icr.io/cp/cp4mcm/cp4mcm-operator-catalog@sha256:2c39ee0ca65f968cc45a00a3e32c25dd6e32910635ed3bd9baae58c9c8875ed9",
          "imageID": "cp.icr.io/cp/cp4mcm/cp4mcm-operator-catalog@sha256:2c39ee0ca65f968cc45a00a3e32c25dd6e32910635ed3bd9baae58c9c8875ed9",
          "lastState": {},
          "name": "ibm-management-registry-server",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2020-09-14T17:14:54Z"
            }
          }
        }
      ],
      "hostIP": "192.168.10.32",
      "phase": "Running",
      "podIP": "10.128.2.11",
      "podIPs": [
        {
          "ip": "10.128.2.11"
        }
      ],
      "qosClass": "Burstable",
      "startTime": "2020-09-14T17:14:42Z"
    }
  },
  "Project": {
    "apiVersion": "project.openshift.io/v1",
    "kind": "Project",
    "metadata": {
      "annotations": {
        "kubectl.kubernetes.io/last-applied-configuration": "{\"apiVersion\":\"v1\",\"kind\":\"Namespace\",\"metadata\":{\"annotations\":{},\"name\":\"bookinfo\"}}\n",
        "mcm.ibm.com/accountID": "id-mycluster-account",
        "mcm.ibm.com/type": "System",
        "openshift.io/sa.scc.mcs": "s0:c28,c7",
        "openshift.io/sa.scc.supplemental-groups": "1000770000/10000",
        "openshift.io/sa.scc.uid-range": "1000770000/10000"
      },
      "name": "{{name}}"
    },
    "spec": {
      "finalizers": [
        "kubernetes"
      ]
    },
    "status": {
      "phase": "Active"
    }
  },
  "ReplicaSet": {
    "apiVersion": "apps/v1",
    "kind": "ReplicaSet",
    "metadata": {
      "annotations": {
        "deployment.kubernetes.io/desired-replicas": "1",
        "deployment.kubernetes.io/max-replicas": "2",
        "deployment.kubernetes.io/revision": "1"
      },
      "labels": {
        "app": "ibm-management-catalog",
        "pod-template-hash": "569c88d69c"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "replicas": 1,
      "selector": {
        "matchLabels": {
          "app": "ibm-management-catalog",
          "pod-template-hash": "569c88d69c"
        }
      },
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "app": "ibm-management-catalog",
            "pod-template-hash": "569c88d69c"
          }
        },
        "spec": {
          "containers": [
            {
              "image": "cp.icr.io/cp/cp4mcm/cp4mcm-operator-catalog@sha256:2c39ee0ca65f968cc45a00a3e32c25dd6e32910635ed3bd9baae58c9c8875ed9",
              "imagePullPolicy": "IfNotPresent",
              "livenessProbe": {
                "exec": {
                  "command": [
                    "grpc_health_probe",
                    "-addr=localhost:50051"
                  ]
                },
                "failureThreshold": 3,
                "initialDelaySeconds": 10,
                "periodSeconds": 10,
                "successThreshold": 1,
                "timeoutSeconds": 1
              },
              "name": "ibm-management-registry-server",
              "ports": [
                {
                  "containerPort": 50051,
                  "name": "grpc",
                  "protocol": "TCP"
                }
              ],
              "readinessProbe": {
                "exec": {
                  "command": [
                    "grpc_health_probe",
                    "-addr=localhost:50051"
                  ]
                },
                "failureThreshold": 3,
                "initialDelaySeconds": 5,
                "periodSeconds": 10,
                "successThreshold": 1,
                "timeoutSeconds": 5
              },
              "resources": {
                "requests": {
                  "cpu": "10m",
                  "memory": "50Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File"
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "imagePullSecrets": [
            {
              "name": "ibm-management-pull-secret"
            }
          ],
          "restartPolicy": "Always",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "default",
          "serviceAccountName": "default",
          "terminationGracePeriodSeconds": 30
        }
      }
    },
    "status": {
      "availableReplicas": 1,
      "fullyLabeledReplicas": 1,
      "observedGeneration": 1,
      "readyReplicas": 1,
      "replicas": 1
    }
  },
  "ResourceQuota": {
    "apiVersion": "v1",
    "kind": "ResourceQuota",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "hard": {
        "limits.cpu": "40",
        "limits.memory": "80Gi",
        "pods": "100",
        "requests.cpu": "20",
        "requests.memory": "40Gi"
      }
    },
    "status": {
      "hard": {
        "limits.cpu": "40",
        "limits.memory": "80Gi",
        "pods": "100",
        "requests.cpu": "20",
        "requests.memory": "40Gi"
      },
      "used": {
        "limits.cpu": "9200m",
        "limits.memory": "18Gi",
        "pods": "58",
        "requests.cpu": "6500m",
        "requests.memory": "12Gi"
      }
    }
  },
  "Role": {
    "apiVersion": "rbac.authorization.k8s.io/v1",
    "kind": "Role",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "rules": [
      {
        "apiGroups": [
          "app.ibm.com"
        ],
        "resources": [
          "deployables",
          "deployables/status",
          "channels",
          "channels/status"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ]
      },
      {
        "apiGroups": [
          ""
        ],
        "resources": [
          "secrets",
          "configmaps"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ]
      }
    ]
  },
  "RoleBinding": {
    "apiVersion": "rbac.authorization.k8s.io/v1",
    "kind": "RoleBinding",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "roleRef": {
      "apiGroup": "rbac.authorization.k8s.io",
      "kind": "Role",
      "name": "bookinfo-channel"
    },
    "subjects": [
      {
        "apiGroup": "rbac.authorization.k8s.io",
        "kind": "User",
        "name": "hcm:clusters:greedo-managed-1:greedo-managed-1"
      },
      {
        "apiGroup": "rbac.authorization.k8s.io",
        "kind": "User",
        "name": "hcm:clusters:greedo-managed-2:greedo-managed-2"
      },
      {
        "apiGroup": "rbac.authorization.k8s.io",
        "kind": "User",
        "name": "hcm:clusters:test:test"
      }
    ]
  },
  "Route": {
    "apiVersion": "route.openshift.io/v1",
    "kind": "Route",
    "metadata": {
      "labels": {
        "app": "management-ingress",
        "app.kubernetes.io/component": "management-ingress",
        "app.kubernetes.io/instance": "icp-management-ingress",
        "app.kubernetes.io/managed-by": "",
        "app.kubernetes.io/name": "management-ingress",
        "component": "management-ingress"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "host": "cp-console.apps.greedo.coc-ibm.com",
      "tls": {
        "caCertificate": "-----BEGIN CERTIFICATE-----\nMIIDMjCCAhqgAwIBAgIRAMWvrxgBxUnj8ehcEfozwskwDQYJKoZIhvcNAQELBQAw\nMzEVMBMGA1UEChMMY2VydC1tYW5hZ2VyMRowGAYDVQQDExFjcy1jYS1jZXJ0aWZp\nY2F0ZTAeFw0yMDA5MTQxNzE3MTlaFw0yMDEyMTMxNzE3MTlaMDMxFTATBgNVBAoT\nDGNlcnQtbWFuYWdlcjEaMBgGA1UEAxMRY3MtY2EtY2VydGlmaWNhdGUwggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC6c+9t4uSR3VeYsdWBxpXFjtIzH0PV\nndavoLf6wukB65ty+6DCFnt2rU43x1JH3MCrmxqDY36dyVIABUKkOlSf7e8UM6vv\nwHchQXUXqH/8IMORgC7c3N3Ois7LSdRRVSobgI78EqMFTh47DfacRyGSjHOhTvpv\nsIa/yiXcV6MISE4M5qVHFm56yi8ZpFLw8WzYKRYgCDYy6bK3m9YhMiyrhKA40C9x\n+YVCUR6Rs7iCAI1fyST8SgGxU7Qzk8p8L3th8/HONnxNRlJFwwL0o3vsO8bHsq9X\nC/xBRC1D1mrXhNGilQ6qEgLzhCsIhrtMZEVEbX3TCi/XJXNy4rzwGO/JAgMBAAGj\nQTA/MA4GA1UdDwEB/wQEAwICpDAPBgNVHRMBAf8EBTADAQH/MBwGA1UdEQQVMBOC\nEWNzLWNhLWNlcnRpZmljYXRlMA0GCSqGSIb3DQEBCwUAA4IBAQA+u/PldZid8gRY\n+a6Bgu+O1psmFNK06TrGGl9BV/8odiNepv2hnDMl1rxWGXnjQaNI84m4J1yQHaeR\npVegzUaJt8u/kpbg6TcCzv6ZC396OvjuyoUCgxjBOus7RO4RDOD1rsn9TUeDSwY5\npW4D6bdMRAh75CbjclY495s56PSHWc51+Fo3MDm8EDK8/agDcxojntt8lbswa9Sk\nLTWg/lfeiMq/+0o6dBoNFc6Lw+Bck26oLIHaDDnuyMvCOsi4AMQQwDpfjHzOXX5p\nCZKOW4bbnZ9dPRcRcr/5gsqQgBcC77PeuXVBqsOykQ7o6JL5w7xeCUk/v0oYm7xW\nJjclvlVN\n-----END CERTIFICATE-----\n",
        "certificate": "-----BEGIN CERTIFICATE-----\nMIIDaTCCAlGgAwIBAgIQGgag1XJi2EhlJCK8EF46jDANBgkqhkiG9w0BAQsFADAz\nMRUwEwYDVQQKEwxjZXJ0LW1hbmFnZXIxGjAYBgNVBAMTEWNzLWNhLWNlcnRpZmlj\nYXRlMB4XDTIwMDkxNDE3MTc1OFoXDTIxMDkxNDE3MTc1OFowNDEVMBMGA1UEChMM\nY2VydC1tYW5hZ2VyMRswGQYDVQQDExJtYW5hZ2VtZW50LWluZ3Jlc3MwggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDcCP2BEOdlm1wKJtxyFUOkjF1ZklZ+\nNV/aZoE5NhkDK3H6cLDHReMndVR+p2+nsNEULQiFHqSahSH21gh9awt0wQv20DI4\nECYyVdi2Frj2Gsy4pdmK5SA50CUceww5TdU6D0tXWVXXdKuk0blmF+KOD44uxlqr\nhjGbBfq+1fHKcHdduLRP0I8cP0xOFWdDRGcu9J+9UeFDXxl0RZBzomENyRuQ0Xv9\n6wWu2JGFs8T9v8xOczDeOjIQXSzDHbGd0Clz1xxQqssYlQsB4GZE5Jm604QkHkkg\nwhb0XmMjrJs6uNkSfdBooFcBvgl427lM+JkJ1rJwXkcdLSp9QA9LCWaBAgMBAAGj\neDB2MA4GA1UdDwEB/wQEAwIFoDATBgNVHSUEDDAKBggrBgEFBQcDATAMBgNVHRMB\nAf8EAjAAMEEGA1UdEQQ6MDiCEm1hbmFnZW1lbnQtaW5ncmVzc4IiY3AtY29uc29s\nZS5hcHBzLmdyZWVkby5jb2MtaWJtLmNvbTANBgkqhkiG9w0BAQsFAAOCAQEArw49\ndtYvIynyiRqSe/26b//2guFc0IYIUshb3JtWT/+ChVjuGmz+HF7XGrqleGD2Xb3D\nrU9QpcPhtrOFKKvSQLEVA5m8laQd//tuEgtG/CnU38XukCDi38JrCsAqw1KoW60w\nQzUjQuhEFQr7BhYYEqhJBjpN6BnpX0IFfpCcYnblz2xW7ufLCKuAkWp82eB/nPkv\nMoynMAV1h6t3zSLWjOaIYbAa0Snn9ImoyU2Bom9dxs0Z1lHbt6lc3LTJBE1TCCIP\ne1iMInVC/IqDkXljuc19atoGS4j/rrP0tH1nddE1d2MuQgTYF30YcX/uW7ZFSWeX\nGLNLVk375pNaA7F6nw==\n-----END CERTIFICATE-----\n",
        "destinationCACertificate": "-----BEGIN CERTIFICATE-----\nMIIDMjCCAhqgAwIBAgIRAMWvrxgBxUnj8ehcEfozwskwDQYJKoZIhvcNAQELBQAw\nMzEVMBMGA1UEChMMY2VydC1tYW5hZ2VyMRowGAYDVQQDExFjcy1jYS1jZXJ0aWZp\nY2F0ZTAeFw0yMDA5MTQxNzE3MTlaFw0yMDEyMTMxNzE3MTlaMDMxFTATBgNVBAoT\nDGNlcnQtbWFuYWdlcjEaMBgGA1UEAxMRY3MtY2EtY2VydGlmaWNhdGUwggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC6c+9t4uSR3VeYsdWBxpXFjtIzH0PV\nndavoLf6wukB65ty+6DCFnt2rU43x1JH3MCrmxqDY36dyVIABUKkOlSf7e8UM6vv\nwHchQXUXqH/8IMORgC7c3N3Ois7LSdRRVSobgI78EqMFTh47DfacRyGSjHOhTvpv\nsIa/yiXcV6MISE4M5qVHFm56yi8ZpFLw8WzYKRYgCDYy6bK3m9YhMiyrhKA40C9x\n+YVCUR6Rs7iCAI1fyST8SgGxU7Qzk8p8L3th8/HONnxNRlJFwwL0o3vsO8bHsq9X\nC/xBRC1D1mrXhNGilQ6qEgLzhCsIhrtMZEVEbX3TCi/XJXNy4rzwGO/JAgMBAAGj\nQTA/MA4GA1UdDwEB/wQEAwICpDAPBgNVHRMBAf8EBTADAQH/MBwGA1UdEQQVMBOC\nEWNzLWNhLWNlcnRpZmljYXRlMA0GCSqGSIb3DQEBCwUAA4IBAQA+u/PldZid8gRY\n+a6Bgu+O1psmFNK06TrGGl9BV/8odiNepv2hnDMl1rxWGXnjQaNI84m4J1yQHaeR\npVegzUaJt8u/kpbg6TcCzv6ZC396OvjuyoUCgxjBOus7RO4RDOD1rsn9TUeDSwY5\npW4D6bdMRAh75CbjclY495s56PSHWc51+Fo3MDm8EDK8/agDcxojntt8lbswa9Sk\nLTWg/lfeiMq/+0o6dBoNFc6Lw+Bck26oLIHaDDnuyMvCOsi4AMQQwDpfjHzOXX5p\nCZKOW4bbnZ9dPRcRcr/5gsqQgBcC77PeuXVBqsOykQ7o6JL5w7xeCUk/v0oYm7xW\nJjclvlVN\n-----END CERTIFICATE-----\n",
        "insecureEdgeTerminationPolicy": "Redirect",
        "key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA3Aj9gRDnZZtcCibcchVDpIxdWZJWfjVf2maBOTYZAytx+nCw\nx0XjJ3VUfqdvp7DRFC0IhR6kmoUh9tYIfWsLdMEL9tAyOBAmMlXYtha49hrMuKXZ\niuUgOdAlHHsMOU3VOg9LV1lV13SrpNG5Zhfijg+OLsZaq4YxmwX6vtXxynB3Xbi0\nT9CPHD9MThVnQ0RnLvSfvVHhQ18ZdEWQc6JhDckbkNF7/esFrtiRhbPE/b/MTnMw\n3joyEF0swx2xndApc9ccUKrLGJULAeBmROSZutOEJB5JIMIW9F5jI6ybOrjZEn3Q\naKBXAb4JeNu5TPiZCdaycF5HHS0qfUAPSwlmgQIDAQABAoIBAHMP5Hj8vPSeRIgu\ngDLMOd4vZJV1d/Nxt9k+py6iwnus2WKMUXUzb7DvoyrEJhg712nEjuMF/i+rlPI+\nRJxJQOliFf6QKuK0VzUVPUkjIr/Xjdy1JciDPtHcrbtyARdqQymkW9KmrcQIh8Wd\nwmTH8ro1GjYNldaCSyh0/QWUXWdtZlRfkJkPEDVAsMVEAGAkI0ggPtoXZlsxSp6p\n4MKH9g0+uGeeSDI3b1j+cDC34/RuzgI04PrLc8n3wZiohyHxNrNgSfSd7kd+dg/E\nvXT7XEfpkenNw4ymrRHa0Y/x/SClS09dAnvmROcBT9PEgi1QtTAX/Dl+nUkKXRNu\n/ojXcQECgYEA7nJ1vPxl51JWptpspIjZvJWRNIjvX6EZq1mFjhz5aF5J9n45OZsk\ncpaJz0D0azZzTw7/zbdimjrxD+28my7pvpvKn99U5CnyR8G9UnYF8kgx+xctfV14\nNbenRybx3szzdmb7qCMG2FvUY3tQ1bsr9DvoFD8PlmOcGagel5xB8LECgYEA7DuO\nWEXNNBXitw0XlDKBh01TgCmeazwZ1lq34t9SzVYZU1p6zK3pEPWHjvMIr1QbkNVy\nVSnAjyK3a2+WHD+sRkgvw4qqr5eZSWhg8tpjwBTVOmmTsFZ8+7qVXWNBvQ8aKU3L\n5qonRFQpKn2LM/3Sc5oTMCSSjF02N18CVVR7xtECgYAgagThXPpJWOMYqYatU0Eu\nJrLnjlnkCRVhOrkyGXQ6IN8zF/OVhiaNQTOYrf7L+EnyjFpvz6ciyjJs9Od3vQff\ndnQ0CXsTzTP3VznyVML4LaJFvN/dM/CcdMvTm1Kz8+6AwP0i3SgYD1uu7luNwnT2\nLZKd9fibfA0DW9xUxdQc8QKBgC/6/LNjIgWlOFITn6ljBLn1c7NBQMLpBxppfJXg\n5BF+nlA2vWBbJk5igDEBnc72l064e6teepTX6Ucx99wu9o+j08e0n2xgryqgv6gz\nwTTfRlvB29RiDKqYQAQix9Rdf+PJwFNOVgFj0qSlsSNTN25xadpKY1WNDRj7/B5W\ntXkxAoGBAJmFcPo8DC0qDDs01kL2FLA4mqwklGpFd9mTbHwnrqQhkxS5oqChOTq6\nMovir8nPpVNZ7qqX4CvV/Vq6nyHp2klcQG/Os23itJJMoZRIF7A0idaY8NAjzUTS\neE6IWPfeBJ1w21iLmE8WFLIdSh3NcRDxcXgisEtMByvilikx3QUG\n-----END RSA PRIVATE KEY-----\n",
        "termination": "reencrypt"
      },
      "to": {
        "kind": "Service",
        "name": "icp-management-ingress",
        "weight": 100
      },
      "wildcardPolicy": "None"
    },
    "status": {
      "ingress": [
        {
          "conditions": [
            {
              "lastTransitionTime": "2020-09-14T17:18:09Z",
              "status": "True",
              "type": "Admitted"
            }
          ],
          "host": "cp-console.apps.greedo.coc-ibm.com",
          "routerCanonicalHostname": "apps.greedo.coc-ibm.com",
          "routerName": "default",
          "wildcardPolicy": "None"
        }
      ]
    }
  },
  "Secret": {
    "apiVersion": "v1",
    "data": {
      ".dockercfg": "eyIxNzIuMzAuODcuODc6NTAwMCI6eyJ1c2VybmFtZSI6InNlcnZpY2VhY2NvdW50IiwicGFzc3dvcmQiOiJleUpoYkdjaU9pSlNVekkxTmlJc0ltdHBaQ0k2SWxWT1RtbzJlWGhzZGxaU01WRkxaMUpCTFc5dVl6RTRXbWhUV1hvd1RXWmFkMHBFYnpCVmJFeEtNa1VpZlEuZXlKcGMzTWlPaUpyZFdKbGNtNWxkR1Z6TDNObGNuWnBZMlZoWTJOdmRXNTBJaXdpYTNWaVpYSnVaWFJsY3k1cGJ5OXpaWEoyYVdObFlXTmpiM1Z1ZEM5dVlXMWxjM0JoWTJVaU9pSmliMjlyYVc1bWJ5MWxiblJwZEd4bGJXVnVkQ0lzSW10MVltVnlibVYwWlhNdWFXOHZjMlZ5ZG1salpXRmpZMjkxYm5RdmMyVmpjbVYwTG01aGJXVWlPaUppZFdsc1pHVnlMWFJ2YTJWdUxXSndOemQwSWl3aWEzVmlaWEp1WlhSbGN5NXBieTl6WlhKMmFXTmxZV05qYjNWdWRDOXpaWEoyYVdObExXRmpZMjkxYm5RdWJtRnRaU0k2SW1KMWFXeGtaWElpTENKcmRXSmxjbTVsZEdWekxtbHZMM05sY25acFkyVmhZMk52ZFc1MEwzTmxjblpwWTJVdFlXTmpiM1Z1ZEM1MWFXUWlPaUl6TURsak5HRTVPQzAxTUdObUxUUm1aR0l0WWpkbE1DMWhaRFEwWWpkaE9EUmxaVFVpTENKemRXSWlPaUp6ZVhOMFpXMDZjMlZ5ZG1salpXRmpZMjkxYm5RNlltOXZhMmx1Wm04dFpXNTBhWFJzWlcxbGJuUTZZblZwYkdSbGNpSjkudmsxeVFrdEcxV0R3UnN2YUk2RmZNRlVhWG5ZWldNSDVpYnI3VC1sckFJRGFiTjFFaEhzYkotNFFkMlpaekJXbXlRSE5IclRtYU1sRDZ1enFpOW9CenhIZmdRb0RWRXBral9PZnU0VDhQVWFHODZBZG9NNG5LZGpER0tidDBnMDI5Q1ROd2R4OTl6S0llVXAxdzg3VjV0SGFHanJIaE9kTldmRFdaODM4cWlYWXFaZ2ZvNm44WWhjY2VqUXYxbVhhRFc4WktGd1VBYUpqc1NFeTlkN0hxb1FBV3FmZHRLa2VCZjZjN3VKaHEtSjZFb2VHRTJqZ0sta21NVnVoRVZkQ3RsWFZVMUU2dWY2MVRHTkJNVlBNTU1yeDNuejFicGc2WDZ6WUhqdUNNQXlBMjJBN1N6Q0xhU3pSM1o3c0hWaVRIY256a1RobW9hRW50U0gyOXBHUWZRIiwiZW1haWwiOiJzZXJ2aWNlYWNjb3VudEBleGFtcGxlLm9yZyIsImF1dGgiOiJjMlZ5ZG1salpXRmpZMjkxYm5RNlpYbEthR0pIWTJsUGFVcFRWWHBKTVU1cFNYTkpiWFJ3V2tOSk5rbHNWazlVYlc4eVpWaG9jMlJzV2xOTlZrWk1XakZLUWt4WE9YVlpla1UwVjIxb1ZGZFliM2RVVjFwaFpEQndSV0o2UWxaaVJYaExUV3RWYVdaUkxtVjVTbkJqTTAxcFQybEtjbVJYU214amJUVnNaRWRXZWt3elRteGpibHB3V1RKV2FGa3lUblprVnpVd1NXbDNhV0V6Vm1sYVdFcDFXbGhTYkdONU5YQmllVGw2V2xoS01tRlhUbXhaVjA1cVlqTldkV1JET1hWWlZ6RnNZek5DYUZreVZXbFBhVXBwWWpJNWNtRlhOVzFpZVRGc1ltNVNjR1JIZUd4aVYxWjFaRU5KYzBsdGRERlpiVlo1WW0xV01GcFlUWFZoVnpoMll6SldlV1J0YkdwYVYwWnFXVEk1TVdKdVVYWmpNbFpxWTIxV01FeHROV2hpVjFWcFQybEthV1JYYkhOYVIxWjVURmhTZG1FeVZuVk1WMHAzVG5wa01FbHBkMmxoTTFacFdsaEtkVnBZVW14amVUVndZbms1ZWxwWVNqSmhWMDVzV1ZkT2FtSXpWblZrUXpsNldsaEtNbUZYVG14TVYwWnFXVEk1TVdKdVVYVmliVVowV2xOSk5rbHRTakZoVjNocldsaEphVXhEU25Ka1YwcHNZMjAxYkdSSFZucE1iV3gyVEROT2JHTnVXbkJaTWxab1dUSk9kbVJYTlRCTU0wNXNZMjVhY0ZreVZYUlpWMDVxWWpOV2RXUkROVEZoVjFGcFQybEplazFFYkdwT1IwVTFUME13TVUxSFRtMU1WRkp0V2tkSmRGbHFaR3hOUXpGb1drUlJNRmxxWkdoUFJGSnNXbFJWYVV4RFNucGtWMGxwVDJsS2VtVllUakJhVnpBMll6SldlV1J0YkdwYVYwWnFXVEk1TVdKdVVUWlpiVGwyWVRKc2RWcHRPSFJhVnpVd1lWaFNjMXBYTVd4aWJsRTJXVzVXY0dKSFVteGphVW81TG5ack1YbFJhM1JITVZkRWQxSnpkbUZKTmtabVRVWlZZVmh1V1ZwWFRVZzFhV0p5TjFRdGJISkJTVVJoWWs0eFJXaEljMkpLTFRSUlpESmFXbnBDVjIxNVVVaE9TSEpVYldGTmJFUTJkWHB4YVRsdlFucDRTR1puVVc5RVZrVndhMnBmVDJaMU5GUTRVRlZoUnpnMlFXUnZUVFJ1UzJScVJFZExZblF3WnpBeU9VTlVUbmRrZURrNWVrdEpaVlZ3TVhjNE4xWTFkRWhoUjJweVNHaFBaRTVYWmtSWFdqZ3pPSEZwV0ZseFdtZG1ielp1T0Zsb1kyTmxhbEYyTVcxWVlVUlhPRnBMUm5kVlFXRkthbk5UUlhrNVpEZEljVzlSUVZkeFptUjBTMnRsUW1ZMll6ZDFTbWh4TFVvMlJXOWxSMFV5YW1kTExXdHRUVloxYUVWV1pFTjBiRmhXVlRGRk5uVm1OakZVUjA1Q1RWWlFUVTFOY25nemJub3hZbkJuTmxnMmVsbElhblZEVFVGNVFUSXlRVGRUZWtOTVlWTjZVak5hTjNOSVZtbFVTR051ZW10VWFHMXZZVVZ1ZEZOSU1qbHdSMUZtVVE9PSJ9LCJpbWFnZS1yZWdpc3RyeS5vcGVuc2hpZnQtaW1hZ2UtcmVnaXN0cnkuc3ZjLmNsdXN0ZXIubG9jYWw6NTAwMCI6eyJ1c2VybmFtZSI6InNlcnZpY2VhY2NvdW50IiwicGFzc3dvcmQiOiJleUpoYkdjaU9pSlNVekkxTmlJc0ltdHBaQ0k2SWxWT1RtbzJlWGhzZGxaU01WRkxaMUpCTFc5dVl6RTRXbWhUV1hvd1RXWmFkMHBFYnpCVmJFeEtNa1VpZlEuZXlKcGMzTWlPaUpyZFdKbGNtNWxkR1Z6TDNObGNuWnBZMlZoWTJOdmRXNTBJaXdpYTNWaVpYSnVaWFJsY3k1cGJ5OXpaWEoyYVdObFlXTmpiM1Z1ZEM5dVlXMWxjM0JoWTJVaU9pSmliMjlyYVc1bWJ5MWxiblJwZEd4bGJXVnVkQ0lzSW10MVltVnlibVYwWlhNdWFXOHZjMlZ5ZG1salpXRmpZMjkxYm5RdmMyVmpjbVYwTG01aGJXVWlPaUppZFdsc1pHVnlMWFJ2YTJWdUxXSndOemQwSWl3aWEzVmlaWEp1WlhSbGN5NXBieTl6WlhKMmFXTmxZV05qYjNWdWRDOXpaWEoyYVdObExXRmpZMjkxYm5RdWJtRnRaU0k2SW1KMWFXeGtaWElpTENKcmRXSmxjbTVsZEdWekxtbHZMM05sY25acFkyVmhZMk52ZFc1MEwzTmxjblpwWTJVdFlXTmpiM1Z1ZEM1MWFXUWlPaUl6TURsak5HRTVPQzAxTUdObUxUUm1aR0l0WWpkbE1DMWhaRFEwWWpkaE9EUmxaVFVpTENKemRXSWlPaUp6ZVhOMFpXMDZjMlZ5ZG1salpXRmpZMjkxYm5RNlltOXZhMmx1Wm04dFpXNTBhWFJzWlcxbGJuUTZZblZwYkdSbGNpSjkudmsxeVFrdEcxV0R3UnN2YUk2RmZNRlVhWG5ZWldNSDVpYnI3VC1sckFJRGFiTjFFaEhzYkotNFFkMlpaekJXbXlRSE5IclRtYU1sRDZ1enFpOW9CenhIZmdRb0RWRXBral9PZnU0VDhQVWFHODZBZG9NNG5LZGpER0tidDBnMDI5Q1ROd2R4OTl6S0llVXAxdzg3VjV0SGFHanJIaE9kTldmRFdaODM4cWlYWXFaZ2ZvNm44WWhjY2VqUXYxbVhhRFc4WktGd1VBYUpqc1NFeTlkN0hxb1FBV3FmZHRLa2VCZjZjN3VKaHEtSjZFb2VHRTJqZ0sta21NVnVoRVZkQ3RsWFZVMUU2dWY2MVRHTkJNVlBNTU1yeDNuejFicGc2WDZ6WUhqdUNNQXlBMjJBN1N6Q0xhU3pSM1o3c0hWaVRIY256a1RobW9hRW50U0gyOXBHUWZRIiwiZW1haWwiOiJzZXJ2aWNlYWNjb3VudEBleGFtcGxlLm9yZyIsImF1dGgiOiJjMlZ5ZG1salpXRmpZMjkxYm5RNlpYbEthR0pIWTJsUGFVcFRWWHBKTVU1cFNYTkpiWFJ3V2tOSk5rbHNWazlVYlc4eVpWaG9jMlJzV2xOTlZrWk1XakZLUWt4WE9YVlpla1UwVjIxb1ZGZFliM2RVVjFwaFpEQndSV0o2UWxaaVJYaExUV3RWYVdaUkxtVjVTbkJqTTAxcFQybEtjbVJYU214amJUVnNaRWRXZWt3elRteGpibHB3V1RKV2FGa3lUblprVnpVd1NXbDNhV0V6Vm1sYVdFcDFXbGhTYkdONU5YQmllVGw2V2xoS01tRlhUbXhaVjA1cVlqTldkV1JET1hWWlZ6RnNZek5DYUZreVZXbFBhVXBwWWpJNWNtRlhOVzFpZVRGc1ltNVNjR1JIZUd4aVYxWjFaRU5KYzBsdGRERlpiVlo1WW0xV01GcFlUWFZoVnpoMll6SldlV1J0YkdwYVYwWnFXVEk1TVdKdVVYWmpNbFpxWTIxV01FeHROV2hpVjFWcFQybEthV1JYYkhOYVIxWjVURmhTZG1FeVZuVk1WMHAzVG5wa01FbHBkMmxoTTFacFdsaEtkVnBZVW14amVUVndZbms1ZWxwWVNqSmhWMDVzV1ZkT2FtSXpWblZrUXpsNldsaEtNbUZYVG14TVYwWnFXVEk1TVdKdVVYVmliVVowV2xOSk5rbHRTakZoVjNocldsaEphVXhEU25Ka1YwcHNZMjAxYkdSSFZucE1iV3gyVEROT2JHTnVXbkJaTWxab1dUSk9kbVJYTlRCTU0wNXNZMjVhY0ZreVZYUlpWMDVxWWpOV2RXUkROVEZoVjFGcFQybEplazFFYkdwT1IwVTFUME13TVUxSFRtMU1WRkp0V2tkSmRGbHFaR3hOUXpGb1drUlJNRmxxWkdoUFJGSnNXbFJWYVV4RFNucGtWMGxwVDJsS2VtVllUakJhVnpBMll6SldlV1J0YkdwYVYwWnFXVEk1TVdKdVVUWlpiVGwyWVRKc2RWcHRPSFJhVnpVd1lWaFNjMXBYTVd4aWJsRTJXVzVXY0dKSFVteGphVW81TG5ack1YbFJhM1JITVZkRWQxSnpkbUZKTmtabVRVWlZZVmh1V1ZwWFRVZzFhV0p5TjFRdGJISkJTVVJoWWs0eFJXaEljMkpLTFRSUlpESmFXbnBDVjIxNVVVaE9TSEpVYldGTmJFUTJkWHB4YVRsdlFucDRTR1puVVc5RVZrVndhMnBmVDJaMU5GUTRVRlZoUnpnMlFXUnZUVFJ1UzJScVJFZExZblF3WnpBeU9VTlVUbmRrZURrNWVrdEpaVlZ3TVhjNE4xWTFkRWhoUjJweVNHaFBaRTVYWmtSWFdqZ3pPSEZwV0ZseFdtZG1ielp1T0Zsb1kyTmxhbEYyTVcxWVlVUlhPRnBMUm5kVlFXRkthbk5UUlhrNVpEZEljVzlSUVZkeFptUjBTMnRsUW1ZMll6ZDFTbWh4TFVvMlJXOWxSMFV5YW1kTExXdHRUVloxYUVWV1pFTjBiRmhXVlRGRk5uVm1OakZVUjA1Q1RWWlFUVTFOY25nemJub3hZbkJuTmxnMmVsbElhblZEVFVGNVFUSXlRVGRUZWtOTVlWTjZVak5hTjNOSVZtbFVTR051ZW10VWFHMXZZVVZ1ZEZOSU1qbHdSMUZtVVE9PSJ9LCJpbWFnZS1yZWdpc3RyeS5vcGVuc2hpZnQtaW1hZ2UtcmVnaXN0cnkuc3ZjOjUwMDAiOnsidXNlcm5hbWUiOiJzZXJ2aWNlYWNjb3VudCIsInBhc3N3b3JkIjoiZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNklsVk9UbW8yZVhoc2RsWlNNVkZMWjFKQkxXOXVZekU0V21oVFdYb3dUV1phZDBwRWJ6QlZiRXhLTWtVaWZRLmV5SnBjM01pT2lKcmRXSmxjbTVsZEdWekwzTmxjblpwWTJWaFkyTnZkVzUwSWl3aWEzVmlaWEp1WlhSbGN5NXBieTl6WlhKMmFXTmxZV05qYjNWdWRDOXVZVzFsYzNCaFkyVWlPaUppYjI5cmFXNW1ieTFsYm5ScGRHeGxiV1Z1ZENJc0ltdDFZbVZ5Ym1WMFpYTXVhVzh2YzJWeWRtbGpaV0ZqWTI5MWJuUXZjMlZqY21WMExtNWhiV1VpT2lKaWRXbHNaR1Z5TFhSdmEyVnVMV0p3TnpkMElpd2lhM1ZpWlhKdVpYUmxjeTVwYnk5elpYSjJhV05sWVdOamIzVnVkQzl6WlhKMmFXTmxMV0ZqWTI5MWJuUXVibUZ0WlNJNkltSjFhV3hrWlhJaUxDSnJkV0psY201bGRHVnpMbWx2TDNObGNuWnBZMlZoWTJOdmRXNTBMM05sY25acFkyVXRZV05qYjNWdWRDNTFhV1FpT2lJek1EbGpOR0U1T0MwMU1HTm1MVFJtWkdJdFlqZGxNQzFoWkRRMFlqZGhPRFJsWlRVaUxDSnpkV0lpT2lKemVYTjBaVzA2YzJWeWRtbGpaV0ZqWTI5MWJuUTZZbTl2YTJsdVptOHRaVzUwYVhSc1pXMWxiblE2WW5WcGJHUmxjaUo5LnZrMXlRa3RHMVdEd1JzdmFJNkZmTUZVYVhuWVpXTUg1aWJyN1QtbHJBSURhYk4xRWhIc2JKLTRRZDJaWnpCV215UUhOSHJUbWFNbEQ2dXpxaTlvQnp4SGZnUW9EVkVwa2pfT2Z1NFQ4UFVhRzg2QWRvTTRuS2RqREdLYnQwZzAyOUNUTndkeDk5ektJZVVwMXc4N1Y1dEhhR2pySGhPZE5XZkRXWjgzOHFpWFlxWmdmbzZuOFloY2NlalF2MW1YYURXOFpLRndVQWFKanNTRXk5ZDdIcW9RQVdxZmR0S2tlQmY2Yzd1SmhxLUo2RW9lR0UyamdLLWttTVZ1aEVWZEN0bFhWVTFFNnVmNjFUR05CTVZQTU1NcngzbnoxYnBnNlg2ellIanVDTUF5QTIyQTdTekNMYVN6UjNaN3NIVmlUSGNuemtUaG1vYUVudFNIMjlwR1FmUSIsImVtYWlsIjoic2VydmljZWFjY291bnRAZXhhbXBsZS5vcmciLCJhdXRoIjoiYzJWeWRtbGpaV0ZqWTI5MWJuUTZaWGxLYUdKSFkybFBhVXBUVlhwSk1VNXBTWE5KYlhSd1drTkpOa2xzVms5VWJXOHlaVmhvYzJSc1dsTk5Wa1pNV2pGS1FreFhPWFZaZWtVMFYyMW9WRmRZYjNkVVYxcGhaREJ3UldKNlFsWmlSWGhMVFd0VmFXWlJMbVY1U25Cak0wMXBUMmxLY21SWFNteGpiVFZzWkVkV2Vrd3pUbXhqYmxwd1dUSldhRmt5VG5aa1Z6VXdTV2wzYVdFelZtbGFXRXAxV2xoU2JHTjVOWEJpZVRsNldsaEtNbUZYVG14WlYwNXFZak5XZFdSRE9YVlpWekZzWXpOQ2FGa3lWV2xQYVVwcFlqSTVjbUZYTlcxaWVURnNZbTVTY0dSSGVHeGlWMVoxWkVOSmMwbHRkREZaYlZaNVltMVdNRnBZVFhWaFZ6aDJZekpXZVdSdGJHcGFWMFpxV1RJNU1XSnVVWFpqTWxacVkyMVdNRXh0TldoaVYxVnBUMmxLYVdSWGJITmFSMVo1VEZoU2RtRXlWblZNVjBwM1RucGtNRWxwZDJsaE0xWnBXbGhLZFZwWVVteGplVFZ3WW5rNWVscFlTakpoVjA1c1dWZE9hbUl6Vm5Wa1F6bDZXbGhLTW1GWFRteE1WMFpxV1RJNU1XSnVVWFZpYlVaMFdsTkpOa2x0U2pGaFYzaHJXbGhKYVV4RFNuSmtWMHBzWTIwMWJHUkhWbnBNYld4MlRETk9iR051V25CWk1sWm9XVEpPZG1SWE5UQk1NMDVzWTI1YWNGa3lWWFJaVjA1cVlqTldkV1JETlRGaFYxRnBUMmxKZWsxRWJHcE9SMFUxVDBNd01VMUhUbTFNVkZKdFdrZEpkRmxxWkd4TlF6Rm9Xa1JSTUZscVpHaFBSRkpzV2xSVmFVeERTbnBrVjBscFQybEtlbVZZVGpCYVZ6QTJZekpXZVdSdGJHcGFWMFpxV1RJNU1XSnVVVFpaYlRsMllUSnNkVnB0T0hSYVZ6VXdZVmhTYzFwWE1XeGlibEUyV1c1V2NHSkhVbXhqYVVvNUxuWnJNWGxSYTNSSE1WZEVkMUp6ZG1GSk5rWm1UVVpWWVZodVdWcFhUVWcxYVdKeU4xUXRiSEpCU1VSaFlrNHhSV2hJYzJKS0xUUlJaREphV25wQ1YyMTVVVWhPU0hKVWJXRk5iRVEyZFhweGFUbHZRbnA0U0dablVXOUVWa1Z3YTJwZlQyWjFORlE0VUZWaFJ6ZzJRV1J2VFRSdVMyUnFSRWRMWW5Rd1p6QXlPVU5VVG5ka2VEazVla3RKWlZWd01YYzROMVkxZEVoaFIycHlTR2hQWkU1WFprUlhXamd6T0hGcFdGbHhXbWRtYnpadU9GbG9ZMk5sYWxGMk1XMVlZVVJYT0ZwTFJuZFZRV0ZLYW5OVFJYazVaRGRJY1c5UlFWZHhabVIwUzJ0bFFtWTJZemQxU21oeExVbzJSVzlsUjBVeWFtZExMV3R0VFZaMWFFVldaRU4wYkZoV1ZURkZOblZtTmpGVVIwNUNUVlpRVFUxTmNuZ3pibm94WW5Cbk5sZzJlbGxJYW5WRFRVRjVRVEl5UVRkVGVrTk1ZVk42VWpOYU4zTklWbWxVU0dOdWVtdFVhRzF2WVVWdWRGTklNamx3UjFGbVVRPT0ifX0="
    },
    "kind": "Secret",
    "metadata": {
      "annotations": {
        "kubernetes.io/service-account.name": "builder",
        "kubernetes.io/service-account.uid": "309c4a98-50cf-4fdb-b7e0-ad44b7a84ee5",
        "openshift.io/token-secret.name": "builder-token-bp77t",
        "openshift.io/token-secret.value": "eyJhbGciOiJSUzI1NiIsImtpZCI6IlVOTmo2eXhsdlZSMVFLZ1JBLW9uYzE4WmhTWXowTWZad0pEbzBVbExKMkUifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJib29raW5mby1lbnRpdGxlbWVudCIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJidWlsZGVyLXRva2VuLWJwNzd0Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6ImJ1aWxkZXIiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiIzMDljNGE5OC01MGNmLTRmZGItYjdlMC1hZDQ0YjdhODRlZTUiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6Ym9va2luZm8tZW50aXRsZW1lbnQ6YnVpbGRlciJ9.vk1yQktG1WDwRsvaI6FfMFUaXnYZWMH5ibr7T-lrAIDabN1EhHsbJ-4Qd2ZZzBWmyQHNHrTmaMlD6uzqi9oBzxHfgQoDVEpkj_Ofu4T8PUaG86AdoM4nKdjDGKbt0g029CTNwdx99zKIeUp1w87V5tHaGjrHhOdNWfDWZ838qiXYqZgfo6n8YhccejQv1mXaDW8ZKFwUAaJjsSEy9d7HqoQAWqfdtKkeBf6c7uJhq-J6EoeGE2jgK-kmMVuhEVdCtlXVU1E6uf61TGNBMVPMMMrx3nz1bpg6X6zYHjuCMAyA22A7SzCLaSzR3Z7sHViTHcnzkThmoaEntSH29pGQfQ"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "type": "kubernetes.io/dockercfg"
  },
  "Service": {
    "apiVersion": "v1",
    "kind": "Service",
    "metadata": {
      "labels": {
        "ibm-management-orchestrator.management.ibm.com": "ibm-management.cp4m"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "clusterIP": "None",
      "selector": {
        "app": "ibm-management-catalog"
      },
      "sessionAffinity": "None",
      "type": "ClusterIP"
    },
    "status": {
      "loadBalancer": {}
    }
  },
  "ServiceAccount": {
    "apiVersion": "v1",
    "imagePullSecrets": [
      {
        "name": "builder-dockercfg-xldpv"
      }
    ],
    "kind": "ServiceAccount",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "secrets": [
      {
        "name": "builder-token-cfnvt"
      },
      {
        "name": "builder-dockercfg-xldpv"
      }
    ]
  },
  "StatefulSet": {
    "apiVersion": "apps/v1",
    "kind": "StatefulSet",
    "metadata": {
      "labels": {
        "app.kubernetes.io/instance": "common-monitoring",
        "app.kubernetes.io/managed-by": "ibm-monitoring-prometheusext-operator",
        "app.kubernetes.io/name": "ibm-monitoring",
        "component": "alertmanager",
        "cs/app": "ibm-monitoring",
        "managed": "ibm-monitoring",
        "operator.ibm.com/opreq-control": "true"
      },
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "podManagementPolicy": "Parallel",
      "replicas": 1,
      "revisionHistoryLimit": 10,
      "selector": {
        "matchLabels": {
          "alertmanager": "ibm-monitoring-alertmanager",
          "app": "alertmanager"
        }
      },
      "serviceName": "alertmanager-operated",
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "alertmanager": "ibm-monitoring-alertmanager",
            "app": "alertmanager"
          }
        },
        "spec": {
          "containers": [
            {
              "args": [
                "--config.file=/etc/alertmanager/config/alertmanager.yaml",
                "--cluster.listen-address=[$(POD_IP)]:9094",
                "--storage.path=/alertmanager",
                "--data.retention=120h",
                "--web.listen-address=:9093",
                "--web.external-url=https://cp-console.apps.greedo.coc-ibm.com:443/alertmanager",
                "--web.route-prefix=/alertmanager",
                "--cluster.peer=alertmanager-ibm-monitoring-alertmanager-0.alertmanager-operated.ibm-common-services.svc:9094"
              ],
              "env": [
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                }
              ],
              "image": "quay.io/opencloudio/alertmanager@sha256:4810de4093d11a0e5477ffc252e47561d36bbea57b288246a33d561e25495355",
              "imagePullPolicy": "IfNotPresent",
              "livenessProbe": {
                "failureThreshold": 10,
                "httpGet": {
                  "path": "/alertmanager/-/healthy",
                  "port": "web",
                  "scheme": "HTTP"
                },
                "periodSeconds": 10,
                "successThreshold": 1,
                "timeoutSeconds": 3
              },
              "name": "alertmanager",
              "ports": [
                {
                  "containerPort": 9093,
                  "name": "web",
                  "protocol": "TCP"
                },
                {
                  "containerPort": 9094,
                  "name": "mesh-tcp",
                  "protocol": "TCP"
                },
                {
                  "containerPort": 9094,
                  "name": "mesh-udp",
                  "protocol": "UDP"
                }
              ],
              "readinessProbe": {
                "failureThreshold": 10,
                "httpGet": {
                  "path": "/alertmanager/-/ready",
                  "port": "web",
                  "scheme": "HTTP"
                },
                "initialDelaySeconds": 3,
                "periodSeconds": 5,
                "successThreshold": 1,
                "timeoutSeconds": 3
              },
              "resources": {
                "requests": {
                  "cpu": "20m",
                  "memory": "128Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "FallbackToLogsOnError",
              "volumeMounts": [
                {
                  "mountPath": "/etc/alertmanager/config",
                  "name": "config-volume"
                },
                {
                  "mountPath": "/alertmanager",
                  "name": "alertmanager-ibm-monitoring-alertmanager-db",
                  "subPath": "alertmanager-db"
                },
                {
                  "mountPath": "/etc/alertmanager/secrets/ibm-monitoring-certs",
                  "name": "secret-ibm-monitoring-certs",
                  "readOnly": true
                },
                {
                  "mountPath": "/etc/alertmanager/secrets/ibm-monitoring-client-certs",
                  "name": "secret-ibm-monitoring-client-certs",
                  "readOnly": true
                },
                {
                  "mountPath": "/etc/alertmanager/configmaps/ibm-monitoring-prometheus-router-entry",
                  "name": "configmap-ibm-monitoring-prometheus-router-entry",
                  "readOnly": true
                },
                {
                  "mountPath": "/etc/alertmanager/configmaps/ibm-monitoring-alertmanager-router-ng",
                  "name": "configmap-ibm-monitoring-alertmanager-router-ng",
                  "readOnly": true
                }
              ]
            },
            {
              "args": [
                "-webhook-url=http://localhost:9093/alertmanager/-/reload",
                "-volume-dir=/etc/alertmanager/config"
              ],
              "image": "quay.io/opencloudio/configmap-reload@sha256:c55a9bac9ea08a6973dc89cd996352ab44207b677e255c005bf5b053273d7c31",
              "imagePullPolicy": "IfNotPresent",
              "name": "config-reloader",
              "resources": {
                "limits": {
                  "cpu": "100m",
                  "memory": "25Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "FallbackToLogsOnError",
              "volumeMounts": [
                {
                  "mountPath": "/etc/alertmanager/config",
                  "name": "config-volume",
                  "readOnly": true
                }
              ]
            },
            {
              "command": [
                "/bin/sh",
                "-c",
                "cp /opt/ibm/router/entry/entrypoint.sh /opt/ibm/router/; chmod 744 /opt/ibm/router/entrypoint.sh;exec /opt/ibm/router/entrypoint.sh"
              ],
              "image": "quay.io/opencloudio/icp-management-ingress@sha256:0070e99691123f2437f5d5b1422f9d0b8eec5746f72e656d1fc9e7947a56e00e",
              "imagePullPolicy": "IfNotPresent",
              "name": "router",
              "ports": [
                {
                  "containerPort": 8080,
                  "name": "router",
                  "protocol": "TCP"
                }
              ],
              "resources": {},
              "securityContext": {
                "allowPrivilegeEscalation": false,
                "capabilities": {
                  "add": [
                    "CHOWN",
                    "NET_ADMIN",
                    "NET_RAW",
                    "LEASE",
                    "SETGID",
                    "SETUID"
                  ],
                  "drop": [
                    "ALL"
                  ]
                },
                "privileged": false,
                "readOnlyRootFilesystem": false
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/opt/ibm/router/caCerts",
                  "name": "secret-ibm-monitoring-certs"
                },
                {
                  "mountPath": "/opt/ibm/router/certs",
                  "name": "secret-ibm-monitoring-certs"
                },
                {
                  "mountPath": "/opt/ibm/router/entry",
                  "name": "configmap-ibm-monitoring-prometheus-router-entry"
                },
                {
                  "mountPath": "/opt/ibm/router/conf",
                  "name": "configmap-ibm-monitoring-alertmanager-router-ng"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Always",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "ibm-monitoring-prometheusext-operand",
          "serviceAccountName": "ibm-monitoring-prometheusext-operand",
          "terminationGracePeriodSeconds": 120,
          "volumes": [
            {
              "name": "config-volume",
              "secret": {
                "defaultMode": 420,
                "secretName": "alertmanager-ibm-monitoring-alertmanager"
              }
            },
            {
              "name": "secret-ibm-monitoring-certs",
              "secret": {
                "defaultMode": 420,
                "secretName": "ibm-monitoring-certs"
              }
            },
            {
              "name": "secret-ibm-monitoring-client-certs",
              "secret": {
                "defaultMode": 420,
                "secretName": "ibm-monitoring-client-certs"
              }
            },
            {
              "configMap": {
                "defaultMode": 420,
                "name": "ibm-monitoring-prometheus-router-entry"
              },
              "name": "configmap-ibm-monitoring-prometheus-router-entry"
            },
            {
              "configMap": {
                "defaultMode": 420,
                "name": "ibm-monitoring-alertmanager-router-ng"
              },
              "name": "configmap-ibm-monitoring-alertmanager-router-ng"
            }
          ]
        }
      },
      "updateStrategy": {
        "type": "RollingUpdate"
      },
      "volumeClaimTemplates": [
        {
          "metadata": {
            "creationTimestamp": null,
            "name": "alertmanager-ibm-monitoring-alertmanager-db"
          },
          "spec": {
            "accessModes": [
              "ReadWriteOnce"
            ],
            "resources": {
              "requests": {
                "storage": "10Gi"
              }
            },
            "storageClassName": "managed-nfs-storage",
            "volumeMode": "Filesystem"
          },
          "status": {
            "phase": "Pending"
          }
        }
      ]
    },
    "status": {
      "collisionCount": 0,
      "currentReplicas": 1,
      "currentRevision": "alertmanager-ibm-monitoring-alertmanager-57f5d59cb9",
      "observedGeneration": 3,
      "readyReplicas": 1,
      "replicas": 1,
      "updateRevision": "alertmanager-ibm-monitoring-alertmanager-57f5d59cb9",
      "updatedReplicas": 1
    }
  },
  "StorageClass": {
    "apiVersion": "storage.k8s.io/v1",
    "kind": "StorageClass",
    "metadata": {
      "labels": {
        "local.storage.openshift.io/owner-name": "local-disks-fs",
        "local.storage.openshift.io/owner-namespace": "local-storage"
      },
      "name": "{{name}}"
    },
    "provisioner": "kubernetes.io/no-provisioner",
    "reclaimPolicy": "Delete",
    "volumeBindingMode": "WaitForFirstConsumer"
  },
  "VolumeAttachment": {
    "apiVersion": "storage.k8s.io/v1",
    "kind": "VolumeAttachment",
    "metadata": {
      "name": "{{name}}"
    },
    "spec": {
      "attacher": "openshift-storage.rbd.csi.ceph.com",
      "nodeName": "{{nodeName}}",
      "source": {
        "persistentVolumeName": "pvc-6f9148e9-41d8-4752-9243-745ab73219d1"
      }
    },
    "status": {
      "attached": true
    }
  },
  "GatewayClass": {
    "apiVersion": "gateway.networking.k8s.io/v1",
    "kind": "GatewayClass",
    "metadata": {
      "name": "{{name}}"
    },
    "spec": {
      "controllerName": "example.net/gateway-controller"
    },
    "status": {
      "conditions": [
        {
          "type": "Accepted",
          "status": "True",
          "reason": "Accepted",
          "message": "Valid GatewayClass",
          "lastTransitionTime": "2024-01-01T00:00:00Z",
          "observedGeneration": 1
        }
      ]
    }
  },
  "Gateway": {
    "apiVersion": "gateway.networking.k8s.io/v1",
    "kind": "Gateway",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "gatewayClassName": "example",
      "listeners": [
        {
          "name": "http",
          "protocol": "HTTP",
          "port": 80,
          "allowedRoutes": {
            "namespaces": {
              "from": "Same"
            }
          }
        }
      ]
    },
    "status": {
      "addresses": [
        {
          "type": "IPAddress",
          "value": "10.0.0.1"
        }
      ],
      "conditions": [
        {
          "type": "Accepted",
          "status": "True",
          "reason": "Accepted",
          "message": "Gateway is accepted",
          "lastTransitionTime": "2024-01-01T00:00:00Z",
          "observedGeneration": 1
        },
        {
          "type": "Programmed",
          "status": "True",
          "reason": "Programmed",
          "message": "Gateway is programmed",
          "lastTransitionTime": "2024-01-01T00:00:00Z",
          "observedGeneration": 1
        }
      ],
      "listeners": [
        {
          "name": "http",
          "supportedKinds": [
            {
              "group": "gateway.networking.k8s.io",
              "kind": "HTTPRoute"
            }
          ],
          "attachedRoutes": 1,
          "conditions": [
            {
              "type": "Accepted",
              "status": "True",
              "reason": "Accepted",
              "message": "Listener accepted",
              "lastTransitionTime": "2024-01-01T00:00:00Z",
              "observedGeneration": 1
            }
          ]
        }
      ]
    }
  },
  "HTTPRoute": {
    "apiVersion": "gateway.networking.k8s.io/v1",
    "kind": "HTTPRoute",
    "metadata": {
      "name": "{{name}}",
      "namespace": "{{namespace}}"
    },
    "spec": {
      "parentRefs": [
        {
          "name": "{{gatewayName}}"
        }
      ],
      "hostnames": [
        "example.com"
      ],
      "rules": [
        {
          "matches": [
            {
              "path": {
                "type": "PathPrefix",
                "value": "/"
              }
            }
          ],
          "backendRefs": [
            {
              "name": "{{serviceName}}",
              "port": 8080
            }
          ]
        }
      ]
    },
    "status": {
      "parents": [
        {
          "parentRef": {
            "name": "{{gatewayName}}"
          },
          "controllerName": "example.net/gateway-controller",
          "conditions": [
            {
              "type": "Accepted",
              "status": "True",
              "reason": "Accepted",
              "message": "Route accepted",
              "lastTransitionTime": "2024-01-01T00:00:00Z",
              "observedGeneration": 1
            },
            {
              "type": "ResolvedRefs",
              "status": "True",
              "reason": "ResolvedRefs",
              "message": "All references resolved",
              "lastTransitionTime": "2024-01-01T00:00:00Z",
              "observedGeneration": 1
            }
          ]
        }
      ]
    }
  }
};
