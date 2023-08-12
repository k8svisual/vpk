<topicKey xreference/>
<topicBack id="topicNext" link="ownerref"/>
<topicNext id="topicBack" link="cluster"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

###### X-Reference 

---

X-references and the creation of custom cross references for VpK.

<div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/pykzLsiAcP4">
    </iframe>
</div>

---

Users can define and create custom cross references refered to as an "xref".  Each "xref" is defined to cross reference one or more Kubernetes resource object elements.  The "xref" definition requires the user to provide the resouce object path to the element to be cross references. More than one path definitions can be defined for each "xref". 

An "xref" is defined with a name, description, K8 resource kind, and path. 

| Field | Values |
|:---:|---|
| name | Any alpha-numeric value without spaces or special characters. |
| description | Brief description of xreff to help user understand what is being xref'd. |
| kind | Kubernetes resource object kind. |
| path | __a.__) A non-space value with periods serperating K8 resource object element names.  <br>__b__.) Resource element names that are arrays must be defined with trailing square brackets containing a single asterisk __[*]__. <br>__c__.) The ending element of the xref defintion can require a matching value. This is accomplished by enclosing the required matching value in double curly brackets __{{value}}__.| 
 
One must understand the structure of the K8 resource yaml used to define the "xref" path definition.   


Examples of valid path definitons follow. Along with reference yaml that is provided to aid in understanding.  All examples are based on an xref using kind of Pod.

* Xref all metadata labels of env.

```
metadata.labels.env
```

* Xref the names of all secrets contained in volumes array.

```
volumes[*].secret.secretName
```
                                
* Xref metadata labels for env with a required value of _prod_.

```
metadata.labels.env{{prod}}
```

* Xref all ConfigMap defintions that use a key named "ui-config" in container env valueFrom sections.

```
spec.containers[*].env[*].valueFrom.configMapKeyRef.key{{ui-config}}
```

__Reference YAML__

_(Portions of yaml content have been removed for example brevity, indicated by three periods.)_

```
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: dawtask
    env: prod
  name: dawtask-5b75b97896-94zgr
  namespace: daw
  ... 
  uid: c8ebe1be-54b6-4af2-ba1e-8fd5ea7f1c46
spec:
  containers:
    - env:
        - name: USERUI
          valueFrom:
            configMapKeyRef:
              key: ui-config
              name: dawtask-ui-config
      image: 'k8debug/daw-task:1.0.0'
      imagePullPolicy: Always
      name: dawtask
  ...
  volumes:
    - emptyDir: {}
      name: runner
    - name: dawtask-token-zx4f9
      secret:
        defaultMode: 420
        secretName: dawtask-token-zx4f9 
  ...        
```

---

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>
