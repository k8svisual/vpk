<topicKey security/>
<topicBack id="topicNext" link="search"/>
<topicNext id="topicBack" link="storage"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

#### Security

---

<!-- Color coded views of roles, bindings, and subjects defined for RBAC. -->

<!-- <div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/zqzGLhoS1VY">
    </iframe>
</div> -->

Security provides a view of the role, subject, and binding for resources in the cluster level or selected namespace.  

From the namespace drop-down select a single namespace.  Once a namespace has been selected press the __View selected namespace__ button. 

If there is no selected namespace a warning message is displayed. 

If several binding results will be shown a dialog is shown that allows the filtering of the results to be shown.  Select one or more for the drop-down
and press the __Filer bindings__ button to view.  Press the __Close__ button to cancel viewing any results.

The results are a graph of the security bindings.  Subjects are shown as a rectangle at the top, bindings are shown as an ellipse in the middle, and 
roles shown as a six-sided object at the bottom of the graph.  Below the Role is a list of the defined rules associated with the Role.

The use of a dashed bounding line is used to group the objects by namespace. 

Click on any of the displayed color rectangles and the associated resource definition will be displayed.

The __Legend__ button can be pressed to view example shapes and colors for the display.

---


